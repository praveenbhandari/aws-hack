from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_ROOT = Path(__file__).resolve().parents[1]

load_dotenv(_REPO_ROOT / ".env.local")
load_dotenv(_BACKEND_ROOT / ".env")
load_dotenv()


def _load_insforge_project() -> dict:
    path = _REPO_ROOT / ".insforge" / "project.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


_insforge_project = _load_insforge_project()


def _env_bool(key: str, fallback: bool) -> bool:
    v = os.environ.get(key)
    if v is None:
        return fallback
    return v in ("1", "true", "True", "TRUE")


def _env_first(*keys: str) -> str:
    for key in keys:
        v = os.environ.get(key)
        if v:
            return v
    return ""


class Config:
    port: int = int(os.environ.get("PORT", "3001"))
    use_mock: bool = _env_bool("USE_MOCK", True)
    insforge_url: str = (
        _env_first("INSFORGE_URL", "NEXT_PUBLIC_INSFORGE_URL") or _insforge_project.get("oss_host", "") or ""
    )
    insforge_anon_key: str = _env_first("INSFORGE_ANON_KEY", "NEXT_PUBLIC_INSFORGE_ANON_KEY")
    insforge_api_key: str = (
        _env_first("INSFORGE_API_KEY", "INSFORGE_SERVICE_KEY") or _insforge_project.get("api_key", "") or ""
    )
    google_maps_api_key: str = _env_first("GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_KEY")
    nebius_api_key: str = os.environ.get("NEBIUS_API_KEY", "")
    nebius_base_url: str = os.environ.get("NEBIUS_BASE_URL", "https://api.tokenfactory.nebius.com/v1")
    nebius_model: str = os.environ.get(
        "NEBIUS_MODEL", "Qwen/Qwen3-30B-A3B-Instruct-2507"
    )
    nebius_vision_model: str = os.environ.get(
        "NEBIUS_VISION_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct"
    )
    crime_csv_path: str = os.environ.get(
        "CRIME_CSV_PATH",
        str(_REPO_ROOT / "data" / "Police_Department_Incident_Reports__2018_to_Present_20260619.csv"),
    )
    # off | record | read | fixtures — see guardian/services/api_cache.py
    api_cache: str = os.environ.get("API_CACHE", "off").lower()


config = Config()


def has_insforge() -> bool:
    return bool(config.insforge_url and (config.insforge_anon_key or config.insforge_api_key))


def has_google_maps() -> bool:
    return bool(config.google_maps_api_key)


def has_nebius() -> bool:
    return bool(config.nebius_api_key)
