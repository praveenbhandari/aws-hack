from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from guardian.config import config, has_nebius
from guardian.services.guardian_agent import GuardianDeps, run_guardian_agent
from guardian.services.tools import TOOL_NAMES

router = APIRouter()


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    user_lat: float | None = None
    user_lng: float | None = None


class AgentChatResponse(BaseModel):
    reply: str
    mode: str
    usage: dict | None = None


@router.get("/tools")
async def list_agent_tools():
    """Tool surface exposed to the Nebius agent (same as Vapi tools)."""
    return {
        "tools": sorted(TOOL_NAMES),
        "model": config.nebius_model,
        "nebiusConfigured": has_nebius(),
    }


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(body: AgentChatRequest):
    try:
        data = await run_guardian_agent(
            body.message,
            deps=GuardianDeps(user_lat=body.user_lat, user_lng=body.user_lng),
            use_mock=config.use_mock or not has_nebius(),
        )
        return data
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Agent failed: {exc}") from exc
