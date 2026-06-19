import json
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from guardian.config import config, has_nebius
from guardian.services.nebius import get_openai_client

router = APIRouter()


class ChatCompletionsBody(BaseModel):
    model: str | None = None
    messages: list[dict[str, Any]] | None = None  # tool/assistant msgs aren't all str-valued
    stream: bool | None = None
    tools: list[dict[str, Any]] | None = None
    tool_choice: Any = None


@router.post("/completions")
async def chat_completions(body: ChatCompletionsBody):
    if not body.stream:
        raise HTTPException(400, "stream:true is required for Vapi proxy")

    client = get_openai_client()
    if not client or not has_nebius():

        async def mock_stream():
            chunk = {
                "id": "guardian-mock",
                "object": "chat.completion.chunk",
                "choices": [
                    {
                        "index": 0,
                        "delta": {
                            "content": (
                                "I'm Guardian, your travel safety companion. "
                                "(mock mode — set NEBIUS_API_KEY for live AI)"
                            )
                        },
                    }
                ],
            }
            yield f"data: {json.dumps(chunk)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(mock_stream(), media_type="text/event-stream")

    async def stream():
        try:
            extra: dict[str, Any] = {}
            if body.tools:
                extra["tools"] = body.tools
                extra["tool_choice"] = body.tool_choice or "auto"
            stream_resp = await client.chat.completions.create(
                model=body.model or config.nebius_model,
                messages=body.messages or [],
                stream=True,
                **extra,
            )
            async for chunk in stream_resp:
                yield f"data: {chunk.model_dump_json()}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"[chat/completions] {e}")

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
