"""Shared Guardian tool dispatch — used by Vapi webhooks and the Nebius agent."""

from __future__ import annotations

import json
from typing import Any

from guardian.services import mock as mock_data
from guardian.services.handlers import get_hotspots, plan_safe_routes, score_safety
from guardian.services.nearby_places import find_nearby_place_with_routes
from guardian.services.streetview_nav import describe_streetview_point

SF_LAT, SF_LNG = 37.7749, -122.4194

TOOL_NAMES = frozenset({
    "get_hotspots",
    "score_safety",
    "get_safe_routes",
    "find_nearby_place",
    "describe_streetview",
})

# Phrasings an LLM uses for "from where I am" — these can't be geocoded, so we
# substitute the caller's GPS coordinates (a "lat,lng" string the Directions API accepts).
_CURRENT_LOCATION_ALIASES = frozenset({
    "", "current", "current location", "currentlocation", "here", "my location",
    "my current location", "current position", "where i am", "this location",
})


async def dispatch_tool(name: str, params: dict[str, Any], *, use_mock: bool = False) -> dict[str, str]:
    if use_mock:
        return mock_data.mock_vapi_tool_result(name)

    if name == "get_hotspots":
        lat = float(params.get("lat", SF_LAT))
        lng = float(params.get("lng", SF_LNG))
        radius = float(params.get("radius", 500))
        data = await get_hotspots(lat, lng, radius)
        return {
            "result": json.dumps(data),
            "message": f"Found {data['count']} hotspots within {radius} meters.",
        }

    if name == "score_safety":
        lat = float(params["lat"])
        lng = float(params["lng"])
        radius_meters = float(params.get("radiusMeters", 300))
        data = await score_safety(lat, lng, radius_meters)
        return {
            "result": json.dumps(data),
            "message": f"Safety score is {data['safetyScore']} out of 100 ({data['riskLevel']} risk).",
        }

    if name == "get_safe_routes":
        origin = str(params.get("origin") or "").strip()
        ulat, ulng = params.get("user_latitude"), params.get("user_longitude")
        if origin.lower() in _CURRENT_LOCATION_ALIASES:
            origin = (
                f"{float(ulat)},{float(ulng)}"
                if ulat is not None and ulng is not None
                else f"{SF_LAT},{SF_LNG}"
            )
        data = await plan_safe_routes(
            {
                "origin": origin,
                "destination": params.get("destination", "Mission Dolores Park, San Francisco"),
                "mode": params.get("mode", "walking"),
                "includeNavigationCues": params.get("includeNavigationCues", True),
                "avoidHeatmap": params.get("avoidHeatmap", True),
            }
        )
        best = data["routes"][0] if data.get("routes") else None
        nav = best.get("navigationSummary") if best else None
        base_msg = (
            f"Found {len(data['routes'])} route(s). Safest scores {best['safetyScore']} out of 100."
            if best
            else "No routes found."
        )
        if nav:
            base_msg += f" Ahead on your route: {nav}"
        return {
            "result": json.dumps(data),
            "message": base_msg,
        }

    if name == "find_nearby_place":
        place_type = str(params.get("place_type") or params.get("type") or "restaurant")
        lat = float(params["user_latitude"]) if params.get("user_latitude") is not None else SF_LAT
        lng = float(params["user_longitude"]) if params.get("user_longitude") is not None else SF_LNG
        data = await find_nearby_place_with_routes(lat, lng, place_type)
        return {
            "result": json.dumps(
                {
                    "voiceSummary": data["voiceSummary"],
                    "places": data["places"],
                    "chosen": data["chosen"],
                }
            ),
            "message": data["voiceSummary"],
        }

    if name == "describe_streetview":
        lat = float(params.get("lat", SF_LAT))
        lng = float(params.get("lng", SF_LNG))
        heading = int(params.get("heading", 0))
        data = await describe_streetview_point(
            lat,
            lng,
            heading=heading,
            segment=str(params.get("segment", "along_route")),
            origin_label=str(params.get("origin_label", "your location")),
            destination_label=str(params.get("destination_label", "destination")),
            mode=str(params.get("mode", "walking")),
        )
        return {
            "result": json.dumps(data),
            "message": data["description"],
        }

    raise ValueError(f"Unknown tool: {name}")
