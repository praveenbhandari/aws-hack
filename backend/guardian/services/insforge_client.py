from __future__ import annotations

from typing import Any

import httpx

from guardian.config import config, has_insforge


class InsForgeError(Exception):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class InsForgeClient:
    """Minimal InsForge HTTP client (database + auth) without the JS SDK."""

    def __init__(self, token: str | None = None):
        if not has_insforge():
            raise InsForgeError("InsForge not configured")
        self.base_url = config.insforge_url.rstrip("/")
        auth_token = token or config.insforge_api_key or config.insforge_anon_key
        self._headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def _records_url(self, table: str) -> str:
        return f"{self.base_url}/api/database/records/{table}"

    async def _request(self, method: str, url: str, **kwargs: Any) -> Any:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.request(method, url, headers=self._headers, **kwargs)
            if resp.status_code >= 400:
                detail = resp.text
                try:
                    detail = resp.json().get("message") or resp.json().get("error") or detail
                except Exception:
                    pass
                raise InsForgeError(str(detail), resp.status_code)
            if resp.status_code == 204 or not resp.content:
                return None
            return resp.json()

    async def select_hotspots(
        self, lat: float, lng: float, radius_m: float, limit: int = 200
    ) -> list[dict[str, Any]]:
        d_lat = radius_m / 111_000
        d_lng = radius_m / (111_000 * __import__("math").cos(lat * __import__("math").pi / 180))
        params: list[tuple[str, str]] = [
            ("select", "id,lat,lng,category,severity,occurred_at,source"),
            ("lat", f"gte.{lat - d_lat}"),
            ("lat", f"lte.{lat + d_lat}"),
            ("lng", f"gte.{lng - d_lng}"),
            ("lng", f"lte.{lng + d_lng}"),
            ("limit", str(limit)),
        ]
        data = await self._request("GET", self._records_url("hotspots"), params=params)
        return data if isinstance(data, list) else []

    async def clear_hotspots(self) -> None:
        params = [("lat", "gte.-90")]
        await self._request("DELETE", self._records_url("hotspots"), params=params)

    async def insert_hotspots(self, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        await self._request("POST", self._records_url("hotspots"), json=rows)
        return len(rows)

    async def list_trips(self) -> list[dict[str, Any]]:
        params = [("order", "created_at.desc")]
        data = await self._request("GET", self._records_url("trips"), params=params)
        return data if isinstance(data, list) else []

    async def insert_trip(self, row: dict[str, Any]) -> dict[str, Any]:
        data = await self._request("POST", self._records_url("trips"), json=[row])
        if isinstance(data, list) and data:
            return data[0]
        return row

    async def sign_up(self, email: str, password: str) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"{self.base_url}/api/auth/users",
            json={"email": email, "password": password},
        )

    async def sign_in(self, email: str, password: str) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"{self.base_url}/api/auth/sessions",
            json={"email": email, "password": password},
        )

    async def get_current_user(self) -> dict[str, Any] | None:
        data = await self._request("GET", f"{self.base_url}/api/auth/sessions/current")
        if isinstance(data, dict):
            return data.get("user")
        return None


def admin_client() -> InsForgeClient:
    return InsForgeClient(token=config.insforge_api_key or None)


def user_client(access_token: str | None = None) -> InsForgeClient:
    return InsForgeClient(token=access_token or config.insforge_anon_key or None)
