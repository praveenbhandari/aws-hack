from __future__ import annotations

from guardian.services.google_maps import fetch_streetview_image, streetview_metadata
from guardian.services.nebius import describe_streetview_for_navigation
from guardian.services.scoring import LatLng, bearing_degrees, sample_polyline, with_weights


def _heading_at(polyline: list[LatLng], index: int) -> int:
    if len(polyline) < 2:
        return 0
    idx = min(max(index, 0), len(polyline) - 2)
    return bearing_degrees(polyline[idx], polyline[idx + 1])


def _pick_cue_points(polyline: list[LatLng]) -> list[tuple[str, LatLng, int]]:
    """Return segment label, location, and camera heading along the route."""
    if len(polyline) < 2:
        return []

    samples = sample_polyline(polyline, 60)
    if len(samples) < 2:
        return []

    start = samples[0]
    approach = samples[max(0, len(samples) - 2)]
    mid_idx = len(samples) // 2
    midpoint = samples[mid_idx]

    return [
        ("departure", start, _heading_at(samples, 0)),
        ("along_route", midpoint, _heading_at(samples, mid_idx)),
        ("approach_destination", approach, _heading_at(samples, max(0, len(samples) - 2))),
    ]


async def build_navigation_cues(
    polyline: list[LatLng],
    *,
    origin_label: str,
    destination_label: str,
    mode: str,
    near_hotspots: list,
    max_cues: int = 2,
) -> list[dict]:
    """
    Fetch Street View (when available) and describe what the walker will see,
    using Nebius vision + InsForge crime context. Directions are assumed done already.
    """
    cues: list[dict] = []
    for segment, point, heading in _pick_cue_points(polyline):
        if len(cues) >= max_cues:
            break

        local_hotspots = with_weights(near_hotspots, point, 120)[:5]
        meta = await streetview_metadata(point["lat"], point["lng"])
        image = None
        if meta.get("available"):
            image = await fetch_streetview_image(
                point["lat"],
                point["lng"],
                heading=heading,
                pitch=0,
            )

        description = await describe_streetview_for_navigation(
            image_bytes=image,
            segment=segment,
            heading=heading,
            origin_label=origin_label,
            destination_label=destination_label,
            mode=mode,
            lat=point["lat"],
            lng=point["lng"],
            nearby_hotspots=local_hotspots,
        )

        cues.append(
            {
                "segment": segment,
                "lat": point["lat"],
                "lng": point["lng"],
                "heading": heading,
                "streetViewAvailable": bool(image),
                "description": description,
            }
        )

    return cues


async def describe_streetview_point(
    lat: float,
    lng: float,
    *,
    heading: int = 0,
    segment: str = "along_route",
    origin_label: str = "your location",
    destination_label: str = "destination",
    mode: str = "walking",
    near_hotspots: list | None = None,
) -> dict:
    """Single-point Street View fetch + Nebius vision (or text-only) description."""
    from guardian.services.hotspots import query_hotspots_near

    hotspots = near_hotspots
    if hotspots is None:
        hotspots = await query_hotspots_near(lat, lng, 200, 80)
    local_hotspots = with_weights(hotspots, {"lat": lat, "lng": lng}, 120)[:5]

    meta = await streetview_metadata(lat, lng)
    image = None
    if meta.get("available"):
        image = await fetch_streetview_image(lat, lng, heading=heading, pitch=0)

    description = await describe_streetview_for_navigation(
        image_bytes=image,
        segment=segment,
        heading=heading,
        origin_label=origin_label,
        destination_label=destination_label,
        mode=mode,
        lat=lat,
        lng=lng,
        nearby_hotspots=local_hotspots,
    )

    return {
        "lat": lat,
        "lng": lng,
        "heading": heading,
        "segment": segment,
        "streetViewAvailable": bool(image),
        "status": meta.get("status", "UNKNOWN"),
        "description": description,
        "imageUrl": f"/maps/streetview/image?lat={lat}&lng={lng}&heading={heading}" if image else None,
    }
