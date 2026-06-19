from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from guardian.services.handlers import plan_safe_routes

router = APIRouter()


class SafeRoutesBody(BaseModel):
    origin: str | dict[str, float]
    destination: str | dict[str, float]
    mode: str | None = "walking"
    includeNavigationCues: bool | None = False
    avoidHeatmap: bool | None = False


@router.post("/safe")
async def safe_routes(body: SafeRoutesBody):
    if not body.origin or not body.destination:
        raise HTTPException(400, "origin and destination are required")
    return await plan_safe_routes(body.model_dump())
