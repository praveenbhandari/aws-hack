import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from guardian.config import config
from guardian.services import mock as mock_data
from guardian.services.handlers import get_hotspots, plan_safe_routes, score_safety
from guardian.services.nearby_places import find_nearby_place_with_routes

router = APIRouter()

TOOL_NAMES = {"get_hotspots", "score_safety", "get_safe_routes", "find_nearby_place"}

SF_LAT, SF_LNG = 37.7749, -122.4194


class VapiToolsRequest(BaseModel):
    message: dict[str, Any] | None = None


class VapiNearbyRequest(BaseModel):
    message: dict[str, Any] | None = None


def _extract_tool_call(body: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    message = body.get("message") or {}
    tool_calls = message.get("toolCallList") or message.get("toolCalls") or []
    if not tool_calls:
        raise HTTPException(400, "No tool calls in request")
    call = tool_calls[0]
    tool_id = call.get("id", "unknown")
    args = call.get("arguments") or call.get("parameters") or {}
    if isinstance(args, str):
        args = json.loads(args)
    return tool_id, args


async def dispatch_tool(name: str, params: dict[str, Any]) -> dict[str, str]:
    if config.use_mock:
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
        data = await plan_safe_routes(
            {
                "origin": params.get("origin", "Union Square, San Francisco"),
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

    raise ValueError(f"Unknown tool: {name}")


@router.post("/find_nearby_place")
async def vapi_find_nearby_place(body: VapiNearbyRequest):
    """Dedicated Vapi webhook for find_nearby_place (server.url per tool)."""
    try:
        tool_id, args = _extract_tool_call(body.model_dump())
        place_type = str(args.get("place_type") or args.get("type") or "restaurant")
        lat = float(args["user_latitude"]) if args.get("user_latitude") is not None else SF_LAT
        lng = float(args["user_longitude"]) if args.get("user_longitude") is not None else SF_LNG
        data = await find_nearby_place_with_routes(lat, lng, place_type)
        payload = {
            "voiceSummary": data["voiceSummary"],
            "places": data["places"],
            "chosen": data["chosen"],
        }
        return {
            "results": [{"toolCallId": tool_id, "result": json.dumps(payload)}],
            "message": {"content": data["voiceSummary"]},
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"find_nearby_place failed: {exc}") from exc


@router.post("/tools")
async def vapi_tools(body: VapiToolsRequest):
    tool_calls = (body.message or {}).get("toolCallList") or []
    results = []
    last_message = ""

    for call in tool_calls:
        name = call.get("name", "")
        tool_call_id = call.get("id", "")
        params = call.get("parameters") or call.get("arguments") or {}

        if name not in TOOL_NAMES:
            results.append(
                {
                    "name": name,
                    "toolCallId": tool_call_id,
                    "error": (
                        f"Unknown tool {name}. Supported: get_hotspots, score_safety, "
                        "get_safe_routes, find_nearby_place"
                    ),
                }
            )
            continue

        try:
            if isinstance(params, str):
                params = json.loads(params)
            out = await dispatch_tool(name, params)
            results.append(
                {
                    "name": name,
                    "toolCallId": tool_call_id,
                    "result": out["result"].replace("\n", " "),
                }
            )
            last_message = out["message"]
        except Exception as e:
            msg = str(e).replace("\n", " ")
            results.append({"name": name, "toolCallId": tool_call_id, "error": msg})

    response: dict[str, Any] = {"results": results}
    if last_message:
        response["message"] = {"content": last_message}
    return response
