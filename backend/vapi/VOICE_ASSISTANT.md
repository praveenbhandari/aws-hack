# Guardian — Vapi voice assistant (our part)

The voice agent that talks to users and calls the backend's safety tools. Brain = **Nebius**
(custom-LLM), tools = Praveen's `/vapi/*` webhooks. This doc captures the config + the two fixes
we made so it's reproducible.

## Architecture

```
Caller ──voice──► Vapi assistant ──custom-LLM──► backend /chat/completions ──► Nebius (Qwen3)
                       │                                                          │ emits tool_call
                       └──dispatches server tool──► backend /vapi/find_nearby_place  (or /vapi/tools)
```

- **Brain:** Vapi `model.provider = "custom-llm"`, `url = <COMPANION_API_BASE_URL>/chat/completions`,
  `model = "Qwen/Qwen3-30B-A3B-Instruct-2507"`. The proxy (`guardian/routers/chat.py`) streams Nebius SSE.
- **Tools (server.url webhooks):**
  - `find_nearby_place` → `<BASE>/vapi/find_nearby_place`
  - `get_safe_routes`, `score_safety` → `<BASE>/vapi/tools`

## Two fixes we made (heads-up for Praveen)

1. **`guardian/routers/chat.py` now forwards `tools` / `tool_choice` to Nebius.** It previously only
   passed `model/messages/stream`, so under custom-LLM **Nebius never received the tools and never
   called them.** `ChatCompletionsBody` gained `tools` + `tool_choice` (and `messages` relaxed to
   `list[dict[str, Any]]` so tool/assistant messages validate). *(This commit.)*
2. **Nebius model:** `config.py`'s default `meta-llama/Meta-Llama-3.1-8B-Instruct-fast` **does not
   exist** on Nebius Token Factory (404). Use **`Qwen/Qwen3-30B-A3B-Instruct-2507`** (fast MoE, good
   tool-calling) — set via `NEBIUS_MODEL` in `backend/.env`. Worth updating the `config.py` default too.

## Run it locally

```bash
cd backend
# .env: USE_MOCK=false, API_CACHE=off, GOOGLE_MAPS_API_KEY=..., NEBIUS_API_KEY=...,
#       NEBIUS_MODEL=Qwen/Qwen3-30B-A3B-Instruct-2507   (InsForge auto-loads from .insforge/project.json)
.venv/bin/python -m uvicorn guardian.main:app --port 3001
# expose it (ngrok needs an account authtoken; cloudflared is free + no-auth):
cloudflared tunnel --url http://localhost:3001   # -> https://<name>.trycloudflare.com = COMPANION_API_BASE_URL
```

## Create the assistant (Vapi private key)

`POST https://api.vapi.ai/assistant` with the payload below (replace `<BASE>` with the tunnel URL).
A ready script lives next to this doc as `guardian-assistant.json`.

```jsonc
{
  "name": "Guardian (SF Safety)",
  "firstMessage": "Hi, I'm Guardian, your San Francisco safety companion...",
  "model": {
    "provider": "custom-llm",
    "model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
    "url": "<BASE>/chat/completions",
    "messages": [{ "role": "system", "content": "You are Guardian... call get_safe_routes / find_nearby_place / score_safety ... 1-2 short sentences for voice." }],
    "tools": [
      { "type": "function", "function": { "name": "find_nearby_place", "parameters": { "type": "object", "properties": { "place_type": {"type":"string"}, "user_latitude": {"type":"number"}, "user_longitude": {"type":"number"} }, "required": ["place_type"] } }, "server": { "url": "<BASE>/vapi/find_nearby_place" } },
      { "type": "function", "function": { "name": "get_safe_routes", "parameters": { "type": "object", "properties": { "origin": {"type":"string"}, "destination": {"type":"string"}, "mode": {"type":"string"} }, "required": ["destination"] } }, "server": { "url": "<BASE>/vapi/tools" } },
      { "type": "function", "function": { "name": "score_safety", "parameters": { "type": "object", "properties": { "lat": {"type":"number"}, "lng": {"type":"number"} }, "required": ["lat","lng"] } }, "server": { "url": "<BASE>/vapi/tools" } }
    ]
  },
  "voice": { "provider": "vapi", "voiceId": "Elliot" },
  "transcriber": { "provider": "deepgram", "model": "nova-2", "language": "en" }
}
```

## Status / verified

- ✅ `/chat/completions` streams Nebius; Qwen3 reliably emits OpenAI tool calls (after fix #1).
- ✅ `/vapi/find_nearby_place` returns real Google place + safe route + risk.
- ✅ Assistant created and wired to the live tunnel.
- ⏳ **Pending:** an end-to-end live voice call (confirms Vapi dispatches the server tools under
  custom-LLM, and the `/chat/completions` URL convention). Test via Vapi dashboard → "Talk to Assistant".

## Notes

- The public Vapi key goes in the **app** (`new Vapi(publicKey)`); the **private** key is for creating
  assistants via the API.
- Use `place_type` values: restaurant, cafe, bart, hospital, hotel, pharmacy, transit.
