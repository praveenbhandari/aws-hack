from fastapi import APIRouter, HTTPException, Query

from guardian.services.handlers import get_hotspots

router = APIRouter()


@router.get("")
async def hotspots(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(400),
    limit: int = Query(800, ge=1, le=2000),
):
    if lat != lat or lng != lng:  # NaN check
        raise HTTPException(400, "lat and lng are required numbers")
    return await get_hotspots(lat, lng, radius, limit)
