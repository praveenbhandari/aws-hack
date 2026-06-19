from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from guardian.services.handlers import score_safety

router = APIRouter()


class SafetyScoreBody(BaseModel):
    lat: float
    lng: float
    radiusMeters: float = 300


@router.post("/score")
async def safety_score(body: SafetyScoreBody):
    return await score_safety(body.lat, body.lng, body.radiusMeters)
