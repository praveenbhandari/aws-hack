from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from guardian.config import has_google_maps
from guardian.services.google_maps import fetch_streetview_image, streetview_metadata

router = APIRouter()


@router.get("/streetview")
async def streetview_info(
    lat: float = Query(...),
    lng: float = Query(...),
):
    if not has_google_maps():
        raise HTTPException(
            503,
            "Google Maps not configured — set GOOGLE_MAPS_API_KEY in backend/.env",
        )
    meta = await streetview_metadata(lat, lng)
    return {
        **meta,
        "imageUrl": f"/maps/streetview/image?lat={lat}&lng={lng}" if meta["available"] else None,
    }


@router.get("/streetview/image")
async def streetview_image(
    lat: float = Query(...),
    lng: float = Query(...),
    heading: int = Query(0, ge=0, le=360),
    pitch: int = Query(0, ge=-90, le=90),
):
    if not has_google_maps():
        raise HTTPException(503, "Google Maps not configured")
    image = await fetch_streetview_image(lat, lng, heading=heading, pitch=pitch)
    if not image:
        raise HTTPException(404, "Street View not available at this location")
    return Response(content=image, media_type="image/jpeg")
