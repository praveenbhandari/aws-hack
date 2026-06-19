from __future__ import annotations

import math

from guardian.services.scoring import (
    LatLng,
    RawHotspot,
    bearing_degrees,
    compute_weight,
    haversine_m,
    sample_polyline,
)


def destination_point(lat: float, lng: float, bearing_deg: float, distance_m: float) -> LatLng:
    """Point reached by moving distance_m along bearing_deg from (lat, lng)."""
    r = 6_371_000
    brng = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lng1 = math.radians(lng)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(distance_m / r)
        + math.cos(lat1) * math.sin(distance_m / r) * math.cos(brng)
    )
    lng2 = lng1 + math.atan2(
        math.sin(brng) * math.sin(distance_m / r) * math.cos(lat1),
        math.cos(distance_m / r) - math.sin(lat1) * math.sin(lat2),
    )
    return {"lat": math.degrees(lat2), "lng": math.degrees(lng2)}


def _cross_track_side(origin: LatLng, destination: LatLng, point: LatLng) -> float:
    """Positive = point is left of origin→destination, negative = right."""
    ox, oy = origin["lng"], origin["lat"]
    dx, dy = destination["lng"] - ox, destination["lat"] - oy
    px, py = point["lng"] - ox, point["lat"] - oy
    return dx * py - dy * px


def detour_waypoint_for_hotspot(
    hotspot: RawHotspot,
    origin: LatLng,
    destination: LatLng,
    *,
    offset_m: float = 220,
) -> LatLng:
    """Push a Google waypoint to the side of the corridor, away from a hotspot."""
    h: LatLng = {"lat": hotspot["lat"], "lng": hotspot["lng"]}
    bearing_od = bearing_degrees(origin, destination)
    side = _cross_track_side(origin, destination, h)
    # Route around the opposite side of the corridor from the hotspot.
    perp = (bearing_od - 90) if side > 0 else (bearing_od + 90)
    return destination_point(h["lat"], h["lng"], perp % 360, offset_m)


def hotspots_blocking_route(
    polyline: list[LatLng],
    hotspots: list[RawHotspot],
    *,
    min_weight: float = 0.28,
    proximity_m: float = 90,
    max_hotspots: int = 3,
) -> list[dict]:
    """Hotspots the polyline passes near, sorted by severity along the path."""
    samples = sample_polyline(polyline, 40)
    found: dict[str, dict] = {}

    for pt in samples:
        for h in hotspots:
            w = compute_weight(h, pt, proximity_m)
            if w < min_weight:
                continue
            hid = str(h.get("id", f"{h['lat']},{h['lng']}"))
            entry = found.get(hid)
            if not entry or entry["routeWeight"] < w:
                found[hid] = {**h, "routeWeight": w, "nearestSample": pt}

    ranked = sorted(
        found.values(),
        key=lambda x: (-x["routeWeight"], -x.get("severity", 0)),
    )
    return ranked[:max_hotspots]


def build_avoidance_waypoints(
    origin: LatLng,
    destination: LatLng,
    baseline_polyline: list[LatLng],
    hotspots: list[RawHotspot],
) -> list[LatLng]:
    """Ordered detour waypoints to steer Google around high-weight hotspots."""
    blocking = hotspots_blocking_route(baseline_polyline, hotspots)
    if not blocking:
        return []

    ordered = sorted(
        blocking,
        key=lambda h: haversine_m(origin, {"lat": h["lat"], "lng": h["lng"]}),
    )

    waypoints: list[LatLng] = []
    seen: set[str] = set()
    for h in ordered:
        wp = detour_waypoint_for_hotspot(h, origin, destination)
        key = f"{wp['lat']:.5f},{wp['lng']:.5f}"
        if key in seen:
            continue
        seen.add(key)
        waypoints.append(wp)
    return waypoints
