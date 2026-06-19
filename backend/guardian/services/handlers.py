from __future__ import annotations

from guardian.config import config
from guardian.services import mock as mock_data
from guardian.services.api_cache import cached
from guardian.services.google_maps import fetch_directions, resolve_location
from guardian.services.hotspots import query_hotspots_near
from guardian.services.nebius import generate_explanation
from guardian.services.scoring import (
    area_risk_to_safety_score,
    compute_weight,
    route_exposure_to_safety_score,
    sample_polyline,
    score_to_risk_level,
    with_weights,
)
from guardian.services.route_avoidance import build_avoidance_waypoints
from guardian.services.streetview_nav import build_navigation_cues


def _route_fingerprint(polyline: list[dict]) -> str:
    if not polyline:
        return ""
    a, b = polyline[0], polyline[-1]
    return f"{a['lat']:.4f},{a['lng']:.4f}-{b['lat']:.4f},{b['lng']:.4f}-{len(polyline)}"


async def _score_google_route(
    gr: dict,
    all_raw: list,
    route_id: str,
    *,
    rerouted: bool = False,
) -> dict:
    samples = sample_polyline(gr["polyline"], 40)
    exposure = 0.0
    near_hotspots = []

    for pt in samples:
        for h in all_raw:
            w = compute_weight(h, pt, 80)
            if w > 0.05:
                exposure += w
                if not any(x["id"] == h["id"] for x in near_hotspots):
                    near_hotspots.append(h)

        weighted = with_weights(
            near_hotspots, samples[0] if samples else gr["polyline"][0], 200, min_weight=0.05
        )
    safety_score = route_exposure_to_safety_score(exposure)
    risk_level = score_to_risk_level(safety_score)
    top = weighted[:5]
    avoided = [h for h in weighted if h.get("weight", 0) >= 0.4 and h.get("severity", 0) >= 4][:3]

    summary = gr.get("summary") or "Route"
    if rerouted:
        summary = f"{summary} (heatmap detour)" if "detour" not in summary.lower() else summary

    explanation = await generate_explanation(
        "route",
        safety_score,
        risk_level,
        top,
        samples[0]["lat"] if samples else gr["polyline"][0]["lat"],
        samples[0]["lng"] if samples else gr["polyline"][0]["lng"],
        200,
    )

    return {
        "id": route_id,
        "summary": summary,
        "polyline": gr["polyline"],
        "encodedPolyline": gr["encodedPolyline"],
        "distanceMeters": gr["distanceMeters"],
        "durationSeconds": gr["durationSeconds"],
        "safetyScore": safety_score,
        "riskLevel": risk_level,
        "hotspotExposure": round(exposure * 100) / 100,
        "avoidedHotspots": avoided,
        "explanation": explanation,
        "reroutedAroundHeatmap": rerouted,
    }


async def _get_hotspots_live(lat: float, lng: float, radius: float, limit: int) -> dict:
    raw = await query_hotspots_near(lat, lng, radius, limit)
    hotspots = with_weights(raw, {"lat": lat, "lng": lng}, radius, min_weight=0.0)
    return {
        "center": {"lat": lat, "lng": lng},
        "radiusMeters": radius,
        "count": len(hotspots),
        "hotspots": hotspots,
    }


async def get_hotspots(lat: float, lng: float, radius: float, limit: int = 800) -> dict:
    if config.use_mock:
        return mock_data.mock_hotspots(lat, lng, radius)

    params = {
        "lat": round(lat, 4),
        "lng": round(lng, 4),
        "radius": int(radius),
        "limit": int(limit),
    }
    return await cached(
        "hotspots",
        params,
        lambda: _get_hotspots_live(lat, lng, radius, limit),
    )


async def _score_safety_live(lat: float, lng: float, radius_meters: float) -> dict:
    raw = await query_hotspots_near(lat, lng, radius_meters)
    hotspots = with_weights(raw, {"lat": lat, "lng": lng}, radius_meters, min_weight=0.001)
    total_risk = sum(h.get("weight", 0) for h in hotspots)
    safety_score = area_risk_to_safety_score(total_risk)
    risk_level = score_to_risk_level(safety_score)
    top_hotspots = hotspots[:5]
    explanation = await generate_explanation(
        "area", safety_score, risk_level, top_hotspots, lat, lng, radius_meters
    )
    return {
        "lat": lat,
        "lng": lng,
        "radiusMeters": radius_meters,
        "safetyScore": safety_score,
        "riskLevel": risk_level,
        "hotspotCount": len(hotspots),
        "topHotspots": top_hotspots,
        "explanation": explanation,
    }


async def score_safety(lat: float, lng: float, radius_meters: float) -> dict:
    if config.use_mock:
        return mock_data.mock_safety_score(lat, lng, radius_meters)

    params = {
        "lat": round(lat, 4),
        "lng": round(lng, 4),
        "radius": int(radius_meters),
    }
    return await cached(
        "safety_score",
        params,
        lambda: _score_safety_live(lat, lng, radius_meters),
    )


async def _plan_safe_routes_live(body: dict) -> dict:
    mode = body.get("mode") or "walking"
    include_navigation_cues = body.get("includeNavigationCues", False)
    avoid_heatmap = bool(body.get("avoidHeatmap", False))
    origin = await resolve_location(body["origin"])
    destination = await resolve_location(body["destination"])
    google_routes = await fetch_directions(origin, destination, mode)

    origin_label = origin.get("address") or (
        body["origin"] if isinstance(body.get("origin"), str) else f'{origin["lat"]:.4f},{origin["lng"]:.4f}'
    )
    dest_label = destination.get("address") or (
        body["destination"]
        if isinstance(body.get("destination"), str)
        else f'{destination["lat"]:.4f},{destination["lng"]:.4f}'
    )

    all_raw = await query_hotspots_near(
        (origin["lat"] + destination["lat"]) / 2,
        (origin["lng"] + destination["lng"]) / 2,
        800,
        500,
    )

    candidate_routes: list[tuple[dict, bool]] = [(gr, False) for gr in google_routes]
    seen = {_route_fingerprint(gr["polyline"]) for gr in google_routes}

    if avoid_heatmap and google_routes:
        baseline = google_routes[0]
        waypoints = build_avoidance_waypoints(origin, destination, baseline["polyline"], all_raw)
        if waypoints:
            detour_routes = await fetch_directions(origin, destination, mode, waypoints=waypoints)
            for gr in detour_routes:
                fp = _route_fingerprint(gr["polyline"])
                if fp not in seen:
                    seen.add(fp)
                    candidate_routes.append((gr, True))

    scored = []
    for i, (gr, rerouted) in enumerate(candidate_routes):
        scored.append(await _score_google_route(gr, all_raw, f"route_{i}", rerouted=rerouted))

    scored.sort(key=lambda r: r["safetyScore"], reverse=True)

    if include_navigation_cues and scored:
        best = scored[0]
        best["navigationCues"] = await build_navigation_cues(
            best["polyline"],
            origin_label=str(origin_label),
            destination_label=str(dest_label),
            mode=mode,
            near_hotspots=all_raw,
            max_cues=2,
        )
        best["navigationSummary"] = " ".join(c["description"] for c in best["navigationCues"])

    return {
        "origin": origin,
        "destination": destination,
        "mode": mode,
        "avoidHeatmap": avoid_heatmap,
        "routes": scored,
    }


async def plan_safe_routes(body: dict) -> dict:
    if config.use_mock:
        return mock_data.mock_safe_routes()

    cache_params = {
        "origin": str(body.get("origin", "")),
        "destination": str(body.get("destination", "")),
        "mode": body.get("mode") or "walking",
        "includeNavigationCues": bool(body.get("includeNavigationCues", False)),
        "avoidHeatmap": bool(body.get("avoidHeatmap", False)),
    }
    return await cached("safe_routes", cache_params, lambda: _plan_safe_routes_live(body))
