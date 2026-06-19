from __future__ import annotations

from guardian.services.google_maps import fetch_directions
from guardian.services.hotspots import query_hotspots_near
from guardian.services.places import find_nearby_places, search_place_by_text
from guardian.services.scoring import (
    compute_weight,
    route_exposure_to_safety_score,
    sample_polyline,
    score_to_risk_level,
)

SF_CENTER = {"lat": 37.7749, "lng": -122.4194}


def format_duration(seconds: int) -> str:
    minutes = max(1, round(seconds / 60))
    if minutes < 60:
        return f"{minutes} min"
    return f"{minutes // 60}h {minutes % 60}m"


async def _score_walking_route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    all_raw: list,
) -> dict | None:
    origin = {"lat": origin_lat, "lng": origin_lng, "address": None}
    destination = {"lat": dest_lat, "lng": dest_lng, "address": None}
    routes = await fetch_directions(origin, destination, "walking")
    if not routes:
        return None

    gr = routes[0]
    samples = sample_polyline(gr["polyline"], 40)
    exposure = 0.0
    for pt in samples:
        for h in all_raw:
            exposure += compute_weight(h, pt, 80)

    safety_score = route_exposure_to_safety_score(exposure)
    risk_level = score_to_risk_level(safety_score)
    risk_score = max(0, 100 - safety_score)

    return {
        "summary": gr.get("summary", "Walking route"),
        "encodedPolyline": gr["encodedPolyline"],
        "polyline": gr["encodedPolyline"],
        "coords": gr["polyline"],
        "distanceMeters": gr["distanceMeters"],
        "durationSeconds": gr["durationSeconds"],
        "durationText": format_duration(gr["durationSeconds"]),
        "safetyScore": safety_score,
        "riskScore": risk_score,
        "riskLevel": risk_level,
        "hotspotExposure": round(exposure * 100) / 100,
    }


async def find_nearby_place_with_routes(
    lat: float | None,
    lng: float | None,
    place_type: str,
    *,
    use_text_search: bool = False,
    text_query: str | None = None,
) -> dict:
    user_lat = lat if lat is not None else SF_CENTER["lat"]
    user_lng = lng if lng is not None else SF_CENTER["lng"]

    if use_text_search and text_query:
        places = await search_place_by_text(text_query, user_lat, user_lng, 5)
    else:
        places = await find_nearby_places(user_lat, user_lng, place_type, 5)

    label = (place_type or "place").strip().lower()
    if not places:
        return {
            "places": [],
            "chosen": None,
            "voiceSummary": f"I couldn't find any nearby {label}. Try a different search.",
        }

    mid_lat = (user_lat + places[0]["latitude"]) / 2
    mid_lng = (user_lng + places[0]["longitude"]) / 2
    all_raw = await query_hotspots_near(mid_lat, mid_lng, 1200, 300)

    scored: list[dict] = []
    for place in places[:3]:
        route = await _score_walking_route(
            user_lat,
            user_lng,
            place["latitude"],
            place["longitude"],
            all_raw,
        )
        if not route:
            continue
        scored.append({**place, "riskScore": route["riskScore"], "route": route})

    if not scored:
        return {
            "places": [],
            "chosen": None,
            "voiceSummary": f"I found {label} options but couldn't build walking routes. Try again.",
        }

    scored.sort(key=lambda p: p["riskScore"])
    chosen = scored[0]
    voice_summary = (
        f"The nearest safe {label} is {chosen['name']} on {chosen['address']}. "
        f"I found a route that takes {chosen['route']['durationText']} and has a low risk score."
    )

    return {
        "places": scored,
        "chosen": 0,
        "voiceSummary": voice_summary,
    }
