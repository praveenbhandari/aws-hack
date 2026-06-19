from __future__ import annotations

from typing import Any

import httpx

from guardian.config import config, has_google_maps

PLACE_TYPE_MAP: dict[str, str] = {
    "restaurant": "restaurant",
    "cafe": "cafe",
    "food": "restaurant",
    "eat": "restaurant",
    "bart": "subway_station",
    "subway": "subway_station",
    "transit": "transit_station",
    "train": "train_station",
    "bus": "bus_station",
    "caltrain": "train_station",
    "hospital": "hospital",
    "pharmacy": "pharmacy",
    "doctor": "hospital",
    "hotel": "lodging",
    "lodging": "lodging",
    "accommodation": "lodging",
    "atm": "atm",
    "bank": "bank",
}

FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.location,places.rating,places.types,places.businessStatus"
)

NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"
TEXT_URL = "https://places.googleapis.com/v1/places:searchText"


def resolve_place_type(place_type: str) -> str:
    key = (place_type or "").strip().lower()
    return PLACE_TYPE_MAP.get(key, key or "restaurant")


def _headers() -> dict[str, str]:
    if not has_google_maps():
        raise RuntimeError("GOOGLE_MAPS_API_KEY is not configured")
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.google_maps_api_key,
        "X-Goog-FieldMask": FIELD_MASK,
    }


def _map_place(place: dict[str, Any]) -> dict[str, Any]:
    display = place.get("displayName") or {}
    location = place.get("location") or {}
    name = display.get("text") if isinstance(display, dict) else str(display)
    return {
        "id": place.get("id", ""),
        "name": name or "Unknown place",
        "address": place.get("formattedAddress", ""),
        "latitude": float(location.get("latitude", 0)),
        "longitude": float(location.get("longitude", 0)),
        "rating": place.get("rating"),
        "types": place.get("types") or [],
        "businessStatus": place.get("businessStatus"),
    }


async def find_nearby_places(
    latitude: float,
    longitude: float,
    place_type: str,
    max_results: int = 5,
) -> list[dict[str, Any]]:
    """Google Places API (New) — nearby search by type."""
    resolved = resolve_place_type(place_type)
    body = {
        "includedTypes": [resolved],
        "maxResultCount": max_results,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": 1500.0,
            }
        },
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(NEARBY_URL, headers=_headers(), json=body)
            if res.status_code >= 400:
                raise RuntimeError(f"Places nearby search failed ({res.status_code}): {res.text}")
            data = res.json()
        places = data.get("places") or []
        return [_map_place(p) for p in places]
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"find_nearby_places failed: {exc}") from exc


async def search_place_by_text(
    query: str,
    latitude: float,
    longitude: float,
    max_results: int = 5,
) -> list[dict[str, Any]]:
    """Google Places API (New) — text search with location bias."""
    body = {
        "textQuery": query,
        "locationBias": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": 5000.0,
            }
        },
        "maxResultCount": max_results,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(TEXT_URL, headers=_headers(), json=body)
            if res.status_code >= 400:
                raise RuntimeError(f"Places text search failed ({res.status_code}): {res.text}")
            data = res.json()
        places = data.get("places") or []
        return [_map_place(p) for p in places]
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(f"search_place_by_text failed: {exc}") from exc
