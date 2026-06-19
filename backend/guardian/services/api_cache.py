"""
Dev cache for expensive external APIs (Google, Nebius, InsForge).

API_CACHE modes (backend/.env):
  off       — always call live APIs (default)
  record    — call live APIs once, save to cache/live/
  read      — serve from cache/live/ (fallback: cache/fixtures/)
  fixtures  — serve bundled cache/fixtures/ only (no API keys needed)

Example workflow:
  1. API_CACHE=record USE_MOCK=false  → run curl once
  2. API_CACHE=read USE_MOCK=false    → fast local UI dev, no API spend
  3. API_CACHE=fixtures               → team demo without keys
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, TypeVar

from guardian.config import config

T = TypeVar("T")

_CACHE_ROOT = Path(__file__).resolve().parent.parent / "cache"
FIXTURES_DIR = _CACHE_ROOT / "fixtures"
LIVE_DIR = _CACHE_ROOT / "live"

# Named demo fixtures for the hackathon UI (Ferry Building → Union Square, SF center)
FIXTURE_ALIASES: dict[str, dict[str, str]] = {
    "safe_routes": {
        "ferry|union|walking|nav": "routes_ferry_union_nav",
        "ferry|union|walking": "routes_ferry_union",
    },
    "hotspots": {
        "37.7749|-122.4194|500": "hotspots_sf_center",
    },
}


def uses_api_cache() -> bool:
    return config.api_cache in ("read", "fixtures", "record")


def is_cache_only() -> bool:
    return config.api_cache in ("read", "fixtures")


def _stable_key(name: str, params: dict[str, Any]) -> str:
    raw = json.dumps({"name": name, "params": params}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _alias_fixture(name: str, params: dict[str, Any]) -> str | None:
    aliases = FIXTURE_ALIASES.get(name, {})
    if name == "safe_routes":
        origin = str(params.get("origin", "")).lower()
        dest = str(params.get("destination", "")).lower()
        mode = str(params.get("mode", "walking")).lower()
        nav = bool(params.get("includeNavigationCues"))
        if "ferry" in origin and "union" in dest:
            key = f"ferry|union|{mode}" + ("|nav" if nav else "")
            return aliases.get(key)
        # Demo fallback: any Ferry Building route uses cached SF downtown data
        if "ferry" in origin:
            return "routes_ferry_union_nav" if nav else "routes_ferry_union"
    if name == "hotspots":
        lat = round(float(params.get("lat", 0)), 4)
        lng = round(float(params.get("lng", 0)), 4)
        radius = int(float(params.get("radius", 0)))
        exact = aliases.get(f"{lat}|{lng}|{radius}")
        if exact:
            return exact
        if 37.76 <= lat <= 37.81 and -122.43 <= lng <= -122.39:
            return "hotspots_sf_center"
    return None


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


async def cached(name: str, params: dict[str, Any], fetch: Callable[[], Awaitable[T]]) -> T:
    mode = config.api_cache
    if mode == "off":
        return await fetch()

    alias = _alias_fixture(name, params)
    fixture_path = FIXTURES_DIR / f"{alias}.json" if alias else None
    live_path = LIVE_DIR / f"{name}_{_stable_key(name, params)}.json"

    if mode == "fixtures":
        if fixture_path and fixture_path.exists():
            print(f"[cache] fixtures → {fixture_path.name}")
            return _load_json(fixture_path)
        raise FileNotFoundError(
            f"No fixture for {name}. Add cache/fixtures/{alias or name}.json or set API_CACHE=read."
        )

    if mode == "read":
        if live_path.exists():
            print(f"[cache] read → {live_path.name}")
            return _load_json(live_path)
        if fixture_path and fixture_path.exists():
            print(f"[cache] fixtures → {fixture_path.name}")
            return _load_json(fixture_path)
        raise FileNotFoundError(
            f"No cache for {name}. Run once with API_CACHE=record or use API_CACHE=fixtures."
        )

    # record: live call + persist
    result = await fetch()
    LIVE_DIR.mkdir(parents=True, exist_ok=True)
    _save_json(live_path, result)
    print(f"[cache] recorded → {live_path.name}")
    return result
