from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from guardian.config import has_insforge
from guardian.services.insforge_client import InsForgeClient, InsForgeError

router = APIRouter()


class TripBody(BaseModel):
    name: str
    origin: str
    destination: str
    mode: str = "walking"


def _token_from_header(authorization: str | None) -> str | None:
    if not authorization:
        return None
    return authorization.removeprefix("Bearer ").strip() or None


@router.get("")
async def list_trips(authorization: str | None = Header(None)):
    if not has_insforge():
        raise HTTPException(503, "InsForge not configured")
    token = _token_from_header(authorization)
    try:
        client = InsForgeClient(token=token) if token else InsForgeClient()
        trips = await client.list_trips()
        return {"trips": trips}
    except InsForgeError as e:
        raise HTTPException(400, str(e)) from e


@router.post("")
async def create_trip(body: TripBody, authorization: str | None = Header(None)):
    if not has_insforge():
        raise HTTPException(503, "InsForge not configured")
    token = _token_from_header(authorization)
    try:
        client = InsForgeClient(token=token) if token else InsForgeClient()
        user = await client.get_current_user()
        user_id = (user or {}).get("id")
        trip = await client.insert_trip(
            {
                "name": body.name,
                "origin": body.origin,
                "destination": body.destination,
                "mode": body.mode,
                "user_id": user_id,
            }
        )
        return {"trip": trip}
    except InsForgeError as e:
        raise HTTPException(400, str(e)) from e
