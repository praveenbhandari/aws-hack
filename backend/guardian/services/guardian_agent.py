"""Guardian orchestration agent — Nebius (Pydantic AI) with safety tools."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from guardian.config import config, has_nebius
from guardian.services.tools import SF_LAT, SF_LNG, dispatch_tool

if TYPE_CHECKING:
    from pydantic_ai import Agent

try:
    from pydantic_ai import Agent, RunContext
    from pydantic_ai.models.openai import OpenAIChatModel
    from pydantic_ai.providers.nebius import NebiusProvider
except ImportError:  # pragma: no cover
    Agent = None  # type: ignore[misc, assignment]
    RunContext = None  # type: ignore[misc, assignment]

SYSTEM_PROMPT = """You are Guardian, a calm travel-safety companion for San Francisco.

You help users:
- Plan safe walking or driving routes that avoid crime hotspots
- Score how safe a location is
- Find nearby places (restaurant, cafe, BART, hospital, pharmacy, hotel) with the safest walk there
- Describe what the user will see ahead using Street View + vision (describe_streetview)

Always call the right tool before giving route or place advice. Keep replies short (1–3 sentences).
Be reassuring, plain, and factual — never alarmist. Match the user's language."""

_agent = None


@dataclass
class GuardianDeps:
    user_lat: float | None = None
    user_lng: float | None = None


def _build_agent() -> Agent:
    if Agent is None:
        raise RuntimeError("pydantic-ai is not installed")

    model = OpenAIChatModel(
        config.nebius_model,
        provider=NebiusProvider(api_key=config.nebius_api_key),
    )
    agent = Agent(
        model,
        deps_type=GuardianDeps,
        system_prompt=SYSTEM_PROMPT,
        name="guardian",
    )

    @agent.tool
    async def get_hotspots(
        ctx: RunContext[GuardianDeps],
        lat: float | None = None,
        lng: float | None = None,
        radius: float = 500,
    ) -> str:
        """Crime hotspot heatmap near a point (lat/lng) within radius meters."""
        out = await dispatch_tool(
            "get_hotspots",
            {
                "lat": lat if lat is not None else (ctx.deps.user_lat or SF_LAT),
                "lng": lng if lng is not None else (ctx.deps.user_lng or SF_LNG),
                "radius": radius,
            },
            use_mock=config.use_mock,
        )
        return out["message"]

    @agent.tool
    async def score_safety(
        ctx: RunContext[GuardianDeps],
        lat: float | None = None,
        lng: float | None = None,
        radius_meters: float = 300,
    ) -> str:
        """Safety score 0–100 for a single location."""
        out = await dispatch_tool(
            "score_safety",
            {
                "lat": lat if lat is not None else (ctx.deps.user_lat or SF_LAT),
                "lng": lng if lng is not None else (ctx.deps.user_lng or SF_LNG),
                "radiusMeters": radius_meters,
            },
            use_mock=config.use_mock,
        )
        return out["message"]

    @agent.tool
    async def get_safe_routes(
        ctx: RunContext[GuardianDeps],
        origin: str,
        destination: str,
        mode: str = "walking",
        avoid_heatmap: bool = True,
    ) -> str:
        """Plan safest routes between two addresses or landmarks. Set avoid_heatmap to detour around crime."""
        out = await dispatch_tool(
            "get_safe_routes",
            {
                "origin": origin,
                "destination": destination,
                "mode": mode,
                "avoidHeatmap": avoid_heatmap,
            },
            use_mock=config.use_mock,
        )
        payload = json.loads(out["result"])
        routes = payload.get("routes") or []
        summary = {
            "origin": payload.get("origin"),
            "destination": payload.get("destination"),
            "routeCount": len(routes),
            "safest": routes[0] if routes else None,
        }
        return f"{out['message']} Details: {json.dumps(summary)[:1200]}"

    @agent.tool
    async def find_nearby_place(
        ctx: RunContext[GuardianDeps],
        place_type: str,
        user_latitude: float | None = None,
        user_longitude: float | None = None,
    ) -> str:
        """Find nearby place types (restaurant, bart, hospital, pharmacy, cafe, hotel) with safest walk."""
        out = await dispatch_tool(
            "find_nearby_place",
            {
                "place_type": place_type,
                "user_latitude": user_latitude if user_latitude is not None else ctx.deps.user_lat,
                "user_longitude": user_longitude if user_longitude is not None else ctx.deps.user_lng,
            },
            use_mock=config.use_mock,
        )
        return out["message"]

    @agent.tool
    async def describe_streetview(
        ctx: RunContext[GuardianDeps],
        lat: float | None = None,
        lng: float | None = None,
        heading: int = 0,
        origin_label: str = "your location",
        destination_label: str = "destination",
    ) -> str:
        """Describe the street ahead using Google Street View + Nebius vision (sidewalk, lighting, safety)."""
        out = await dispatch_tool(
            "describe_streetview",
            {
                "lat": lat if lat is not None else (ctx.deps.user_lat or SF_LAT),
                "lng": lng if lng is not None else (ctx.deps.user_lng or SF_LNG),
                "heading": heading,
                "origin_label": origin_label,
                "destination_label": destination_label,
            },
            use_mock=config.use_mock,
        )
        return out["message"]

    return agent


def get_guardian_agent():
    global _agent
    if _agent is None:
        if not has_nebius():
            raise RuntimeError("NEBIUS_API_KEY is not configured")
        _agent = _build_agent()
    return _agent


async def run_guardian_agent(
    message: str,
    *,
    deps: GuardianDeps | None = None,
    use_mock: bool = False,
) -> dict[str, Any]:
    if use_mock:
        return {
            "reply": (
                "I'm Guardian (mock mode). Set NEBIUS_API_KEY and USE_MOCK=false for the live Nebius agent."
            ),
            "mode": "mock",
        }

    agent = get_guardian_agent()
    result = await agent.run(message, deps=deps or GuardianDeps())
    return {
        "reply": str(result.output),
        "mode": "agent",
        "usage": result.usage().model_dump() if result.usage() else None,
    }
