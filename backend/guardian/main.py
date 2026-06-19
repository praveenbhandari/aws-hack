from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from guardian.config import config
from guardian.services.api_cache import is_cache_only
from guardian.routers import agent, auth, chat, find_nearby_place, hotspots, maps, routes, safety, trips, vapi

app = FastAPI(title="Guardian Companion API", version="0.1.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hotspots.router, prefix="/hotspots", tags=["hotspots"])
app.include_router(safety.router, prefix="/safety", tags=["safety"])
app.include_router(routes.router, prefix="/routes", tags=["routes"])
app.include_router(maps.router, prefix="/maps", tags=["maps"])
app.include_router(find_nearby_place.router, prefix="/find_nearby_place", tags=["places"])
app.include_router(vapi.router, prefix="/vapi", tags=["vapi"])
app.include_router(agent.router, prefix="/agent", tags=["agent"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(trips.router, prefix="/trips", tags=["trips"])


@app.get("/health")
async def health():
    if config.use_mock:
        mode = "mock"
    elif is_cache_only():
        mode = "cached"
    else:
        mode = "live"
    return {
        "status": "ok",
        "version": "0.1.0",
        "mode": mode,
        "apiCache": config.api_cache,
    }


@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, exc: Exception):
    print(f"[error] {exc}")
    return JSONResponse(status_code=500, content={"error": str(exc) or "Internal server error"})
