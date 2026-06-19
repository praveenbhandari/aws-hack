from __future__ import annotations

import base64

from openai import AsyncOpenAI

from guardian.config import config, has_nebius
from guardian.services.scoring import Hotspot, template_explanation

_explanation_cache: dict[str, str] = {}
_client: AsyncOpenAI | None = None


def _cache_key(kind: str, lat: float, lng: float, radius: float) -> str:
    return f"{kind}:{lat:.4f}:{lng:.4f}:{radius}"


def get_openai_client() -> AsyncOpenAI | None:
    global _client
    if not has_nebius():
        return None
    if _client is None:
        _client = AsyncOpenAI(api_key=config.nebius_api_key, base_url=config.nebius_base_url)
    return _client


async def generate_explanation(
    kind: str,
    safety_score: int,
    risk_level: str,
    top_hotspots: list[Hotspot],
    lat: float,
    lng: float,
    radius_meters: float = 300,
) -> str:
    key = _cache_key(kind, lat, lng, radius_meters)
    if key in _explanation_cache:
        return _explanation_cache[key]

    fallback = template_explanation(kind, top_hotspots, safety_score)
    client = get_openai_client()
    if not client:
        _explanation_cache[key] = fallback
        return fallback

    hotspot_summary = "; ".join(
        f'{h["category"]} (severity {h["severity"]}, weight {h.get("weight", 0)})'
        for h in top_hotspots[:5]
    )

    try:
        completion = await client.chat.completions.create(
            model=config.nebius_model,
            max_tokens=80,
            temperature=0.4,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are Guardian, a calm travel-safety companion for mobility-limited users. "
                        "Write exactly one short reassuring sentence about route/area safety. "
                        "Be plain, factual, not alarmist."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Type: {kind}. Safety score: {safety_score}/100 ({risk_level}). "
                        f"Top incidents: {hotspot_summary or 'none nearby'}."
                    ),
                },
            ],
        )
        text = (completion.choices[0].message.content or "").strip().replace("\n", " ")
        result = text if text and len(text) > 10 else fallback
        _explanation_cache[key] = result
        return result
    except Exception as e:
        print(f"[nebius] explanation failed: {e}")
        _explanation_cache[key] = fallback
        return fallback


def _hotspot_context(hotspots: list[Hotspot]) -> str:
    if not hotspots:
        return "no significant incident history nearby"
    return "; ".join(
        f'{h.get("category", "incident")} (severity {h.get("severity", 2)})'
        for h in hotspots[:5]
    )


def _nav_template(
    segment: str,
    origin_label: str,
    destination_label: str,
    heading: int,
    hotspots: list[Hotspot],
) -> str:
    crime = _hotspot_context(hotspots)
    where = {
        "departure": f"starting from {origin_label}",
        "along_route": f"midway toward {destination_label}",
        "approach_destination": f"approaching {destination_label}",
    }.get(segment, f"heading toward {destination_label}")
    return (
        f"On your route {where}, facing {heading}°. "
        f"Historical incident data nearby: {crime}. "
        "Stay aware and stick to well-lit sidewalks."
    )


async def describe_streetview_for_navigation(
    *,
    image_bytes: bytes | None,
    segment: str,
    heading: int,
    origin_label: str,
    destination_label: str,
    mode: str,
    lat: float,
    lng: float,
    nearby_hotspots: list[Hotspot],
) -> str:
    """Describe what the traveler sees ahead, for voice or nav guidance."""
    fallback = _nav_template(segment, origin_label, destination_label, heading, nearby_hotspots)
    client = get_openai_client()
    if not client:
        return fallback

    crime = _hotspot_context(nearby_hotspots)
    segment_label = {
        "departure": "at the start of the walk",
        "along_route": "midway along the route",
        "approach_destination": "near the destination",
    }.get(segment, "along the route")

    user_text = (
        f"You are guiding a mobility-limited traveler {mode} from {origin_label} to {destination_label}. "
        f"This Street View is {segment_label}, camera facing {heading}° ({lat:.5f}, {lng:.5f}). "
        f"InsForge crime data near this point: {crime}. "
        "In one or two short spoken sentences, describe what they will see ahead — "
        "sidewalk width, lighting, openness, crowds, stairs, crossings — "
        "and give practical safety-aware navigation guidance. Calm tone, not alarmist."
    )

    try:
        if image_bytes:
            b64 = base64.standard_b64encode(image_bytes).decode("ascii")
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_text},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                        },
                    ],
                }
            ]
            model = config.nebius_vision_model
        else:
            messages = [
                {
                    "role": "user",
                    "content": user_text + " (No Street View image — use location context only.)",
                }
            ]
            model = config.nebius_model

        completion = await client.chat.completions.create(
            model=model,
            max_tokens=120,
            temperature=0.35,
            messages=messages,
        )
        text = (completion.choices[0].message.content or "").strip().replace("\n", " ")
        return text if text and len(text) > 15 else fallback
    except Exception as e:
        print(f"[nebius] streetview description failed: {e}")
        return fallback
