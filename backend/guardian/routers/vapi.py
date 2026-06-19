import json
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from guardian.config import config
from guardian.services import mock as mock_data
from guardian.services.handlers import get_hotspots, plan_safe_routes, score_safety

router = APIRouter()

TOOL_NAMES = {"get_hotspots", "score_safety", "get_safe_routes"}


class VapiToolCall(BaseModel):
    id: str
    name: str
    parameters: dict[str, Any] = {}


class VapiToolsRequest(BaseModel):
    message: dict[str, Any] | None = None


async def dispatch_tool(name: str, params: dict[str, Any]) -> dict[str, str]:
    if config.use_mock:
        return mock_data.mock_vapi_tool_result(name)

    if name == "get_hotspots":
        lat = float(params.get("lat", 37.7749))
        lng = float(params.get("lng", -122.4194))
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

    raise ValueError(f"Unknown tool: {name}")


@router.post("/tools")
async def vapi_tools(body: VapiToolsRequest):
    tool_calls = (body.message or {}).get("toolCallList") or []
    results = []
    last_message = ""

    for call in tool_calls:
        name = call.get("name", "")
        tool_call_id = call.get("id", "")
        params = call.get("parameters") or {}

        if name not in TOOL_NAMES:
            results.append(
                {
                    "name": name,
                    "toolCallId": tool_call_id,
                    "error": f"Unknown tool {name}. Supported: get_hotspots, score_safety, get_safe_routes",
                }
            )
            continue

        try:
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
