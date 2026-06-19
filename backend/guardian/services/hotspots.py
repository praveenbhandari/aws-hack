from __future__ import annotations

import json
from pathlib import Path

from guardian.config import has_insforge
from guardian.services.insforge_client import InsForgeError, admin_client
from guardian.services.scoring import RawHotspot, category_to_severity

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
SEED_PATH = _BACKEND_ROOT / "data" / "seed-hotspots.json"

_seed_cache: list[RawHotspot] | None = None


def load_seed() -> list[RawHotspot]:
    global _seed_cache
    if _seed_cache is not None:
        return _seed_cache
    if not SEED_PATH.exists():
        _seed_cache = []
        return _seed_cache
    _seed_cache = json.loads(SEED_PATH.read_text())
    return _seed_cache


def bbox_filter(lat: float, lng: float, radius_m: float, rows: list[RawHotspot]) -> list[RawHotspot]:
    import math

    d_lat = radius_m / 111_000
    d_lng = radius_m / (111_000 * math.cos(math.radians(lat)))
    return [
        h
        for h in rows
        if lat - d_lat <= h["lat"] <= lat + d_lat and lng - d_lng <= h["lng"] <= lng + d_lng
    ]


def _row_to_hotspot(row: dict) -> RawHotspot:
    return {
        "id": str(row["id"]),
        "lat": float(row["lat"]),
        "lng": float(row["lng"]),
        "category": str(row["category"]),
        "severity": int(row["severity"]),
        "occurredAt": str(row.get("occurred_at") or row.get("occurredAt", "")),
        "source": str(row.get("source", "sfpd")),
    }


async def query_hotspots_near(
    lat: float, lng: float, radius_meters: float, limit: int = 200
) -> list[RawHotspot]:
    if has_insforge():
        try:
            client = admin_client()
            rows = await client.select_hotspots(lat, lng, radius_meters, limit)
            if rows:
                return [_row_to_hotspot(r) for r in rows]
        except InsForgeError as e:
            print(f"[insforge] hotspots query failed, using seed: {e}")
        except Exception as e:
            print(f"[insforge] hotspots error, using seed: {e}")

    seed = load_seed()
    return bbox_filter(lat, lng, radius_meters, seed)[:limit]


async def clear_hotspots_table() -> None:
    if not has_insforge():
        return
    await admin_client().clear_hotspots()


async def insert_hotspots_batch(rows: list[dict]) -> int:
    if not has_insforge():
        return 0
    return await admin_client().insert_hotspots(rows)
