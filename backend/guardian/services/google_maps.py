from __future__ import annotations

from typing import Any

import httpx
import polyline as polyline_lib

from guardian.config import config, has_google_maps
from guardian.services.scoring import LatLng

TravelMode = str

MODE_MAP = {"walking": "walking", "driving": "driving", "transit": "transit"}


class ResolvedLocation(LatLng, total=False):
    address: str | None


class GoogleRoute(dict):
    pass


def _is_lat_lng(v: Any) -> bool:
    return isinstance(v, dict) and "lat" in v and "lng" in v


async def resolve_location(input_val: str | LatLng) -> ResolvedLocation:
    if _is_lat_lng(input_val):
        return {"lat": float(input_val["lat"]), "lng": float(input_val["lng"]), "address": None}

    if not has_google_maps():
        return {"lat": 37.7955, "lng": -122.3937, "address": str(input_val)}

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": str(input_val), "key": config.google_maps_api_key}
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url, params=params)
        data = res.json()

    if data.get("status") != "OK" or not data.get("results"):
        raise ValueError(f'Geocoding failed for "{input_val}": {data.get("status")}')

    r = data["results"][0]
    loc = r["geometry"]["location"]
    return {"lat": loc["lat"], "lng": loc["lng"], "address": r.get("formatted_address")}


def _fallback_routes(origin: ResolvedLocation, destination: ResolvedLocation) -> list[dict]:
    mid1: LatLng = {
        "lat": (origin["lat"] + destination["lat"]) / 2 + 0.002,
        "lng": (origin["lng"] + destination["lng"]) / 2 - 0.003,
    }
    mid2: LatLng = {
        "lat": (origin["lat"] + destination["lat"]) / 2 - 0.001,
        "lng": (origin["lng"] + destination["lng"]) / 2 + 0.004,
    }
    poly1 = [origin, mid1, destination]
    poly2 = [origin, mid2, destination]

    def enc(pts: list[LatLng]) -> str:
        return "|".join(f'{p["lat"]:.5f},{p["lng"]:.5f}' for p in pts)

    return [
        {
            "summary": "Direct path (seed)",
            "encodedPolyline": enc(poly1),
            "polyline": poly1,
            "distanceMeters": 1400,
            "durationSeconds": 1000,
        },
        {
            "summary": "Alternate path (seed)",
            "encodedPolyline": enc(poly2),
            "polyline": poly2,
            "distanceMeters": 1650,
            "durationSeconds": 1180,
        },
    ]


async def fetch_directions(
    origin: ResolvedLocation,
    destination: ResolvedLocation,
    mode: TravelMode = "walking",
    *,
    waypoints: list[LatLng] | None = None,
) -> list[dict]:
    if not has_google_maps():
        return _fallback_routes(origin, destination)

    url = "https://maps.googleapis.com/maps/api/directions/json"
    params: dict[str, str] = {
        "origin": f'{origin["lat"]},{origin["lng"]}',
        "destination": f'{destination["lat"]},{destination["lng"]}',
        "mode": MODE_MAP.get(mode, "walking"),
        "alternatives": "true",
        "key": config.google_maps_api_key,
    }
    if waypoints:
        params["waypoints"] = "|".join(f'{w["lat"]},{w["lng"]}' for w in waypoints)
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url, params=params)
        data = res.json()

    if data.get("status") != "OK" or not data.get("routes"):
        print(f"[google] directions failed, using fallback: {data.get('status')}")
        return _fallback_routes(origin, destination)

    routes = []
    for route in data["routes"]:
        encoded = route["overview_polyline"]["points"]
        decoded = [{"lat": lat, "lng": lng} for lat, lng in polyline_lib.decode(encoded)]
        legs = route.get("legs", [])
        routes.append(
            {
                "summary": route.get("summary", ""),
                "encodedPolyline": encoded,
                "polyline": decoded,
                "distanceMeters": sum(l["distance"]["value"] for l in legs),
                "durationSeconds": sum(l["duration"]["value"] for l in legs),
            }
        )
    return routes


async def streetview_metadata(lat: float, lng: float) -> dict:
    if not has_google_maps():
        return {"available": False, "status": "MOCK"}

    url = "https://maps.googleapis.com/maps/api/streetview/metadata"
    params = {"location": f"{lat},{lng}", "key": config.google_maps_api_key}
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url, params=params)
        data = res.json()

    return {
        "available": data.get("status") == "OK",
        "status": data.get("status", "UNKNOWN"),
        "panoId": data.get("pano_id"),
        "lat": data.get("location", {}).get("lat", lat),
        "lng": data.get("location", {}).get("lng", lng),
    }


async def fetch_streetview_image(
    lat: float,
    lng: float,
    *,
    width: int = 640,
    height: int = 400,
    heading: int = 0,
    pitch: int = 0,
    fov: int = 90,
) -> bytes | None:
    if not has_google_maps():
        return None

    meta = await streetview_metadata(lat, lng)
    if not meta["available"]:
        return None

    url = "https://maps.googleapis.com/maps/api/streetview"
    params = {
        "location": f"{lat},{lng}",
        "size": f"{width}x{height}",
        "heading": heading,
        "pitch": pitch,
        "fov": fov,
        "key": config.google_maps_api_key,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url, params=params)
        if res.status_code != 200 or not res.content:
            return None
        return res.content
