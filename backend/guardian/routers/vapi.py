import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from guardian.config import config
from guardian.services.nearby_places import find_nearby_place_with_routes
from guardian.services.tools import TOOL_NAMES, dispatch_tool

router = APIRouter()

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
    # Vapi nests the call under `function` (OpenAI shape); fall back to flat keys.
    fn = call.get("function") or {}
    args = fn.get("arguments") or call.get("arguments") or call.get("parameters") or {}
    if isinstance(args, str):
        args = json.loads(args)
    return tool_id, args


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
    message = body.message or {}
    tool_calls = message.get("toolCallList") or message.get("toolCalls") or []
    results = []
    last_message = ""

    for call in tool_calls:
        # Vapi nests name/arguments under `function` (OpenAI shape); fall back to flat keys.
        fn = call.get("function") or {}
        name = fn.get("name") or call.get("name", "")
        tool_call_id = call.get("id", "")
        params = fn.get("arguments") or call.get("parameters") or call.get("arguments") or {}

        if name not in TOOL_NAMES:
            results.append(
                {
                    "name": name,
                    "toolCallId": tool_call_id,
                    "error": (
                        f"Unknown tool {name}. Supported: get_hotspots, score_safety, "
                        "get_safe_routes, find_nearby_place, describe_streetview"
                    ),
                }
            )
            continue

        try:
            if isinstance(params, str):
                params = json.loads(params)
            out = await dispatch_tool(name, params, use_mock=config.use_mock)
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
