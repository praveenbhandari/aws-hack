from fastapi import APIRouter, HTTPException, Query

from guardian.services.nearby_places import find_nearby_place_with_routes

router = APIRouter()

SF_LAT, SF_LNG = 37.7749, -122.4194


@router.get("")
async def get_find_nearby_place(
    type: str = Query(..., alias="type"),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    q: str | None = Query(None, description="Optional text search query"),
):
    try:
        data = await find_nearby_place_with_routes(
            lat if lat is not None else SF_LAT,
            lng if lng is not None else SF_LNG,
            type,
            use_text_search=bool(q),
            text_query=q,
        )
        return data
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from exc
