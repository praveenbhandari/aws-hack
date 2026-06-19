from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from guardian.config import has_insforge
from guardian.services.insforge_client import InsForgeClient, InsForgeError, user_client

router = APIRouter()


class AuthBody(BaseModel):
    email: str
    password: str


@router.post("/signup")
async def signup(body: AuthBody):
    if not has_insforge():
        raise HTTPException(503, "InsForge not configured")
    try:
        data = await user_client().sign_up(body.email, body.password)
        return {"accessToken": data.get("accessToken"), "user": data.get("user")}
    except InsForgeError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/signin")
async def signin(body: AuthBody):
    if not has_insforge():
        raise HTTPException(503, "InsForge not configured")
    try:
        data = await user_client().sign_in(body.email, body.password)
        return {"accessToken": data.get("accessToken"), "user": data.get("user")}
    except InsForgeError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/me")
async def me(authorization: str | None = Header(None)):
    if not has_insforge():
        raise HTTPException(503, "InsForge not configured")
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Missing token")
    try:
        user = await InsForgeClient(token=token).get_current_user()
        return {"user": user}
    except InsForgeError as e:
        raise HTTPException(401, str(e)) from e
