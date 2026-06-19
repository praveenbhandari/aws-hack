# Guardian — Voice + Map Travel Safety Companion

> Working name. A mobile travel companion that warns you about crime hotspots and finds you
> the **safest route** — by voice. Built for the AWS Hackathon by a 3-person team.

## What it does (the demo)

A traveler opens the app in an unfamiliar city. The screen is split:

- **Top:** a live Google Map with a **crime-hotspot heatmap** around them and their current location.
- **Bottom:** a **voice companion** (push-to-talk) with a live transcript and a safety status chip.

They say: *"Find me a safe walk to the train station."*
→ The voice companion thinks (Nebius LLM), calls a tool, and a **safer route appears drawn on
the map in real time**, avoiding a high-crime block. The companion explains out loud:
*"I found a route that avoids the high-crime area on 5th St — it's 3 minutes longer but much safer."*

That **map ↔ voice sync** is the wow moment.

## Stack

| Layer | Tech | Owner |
|---|---|---|
| Mobile app | **React Native (Expo)** | Teammate 1 (UI) |
| Map + routing | **Google Maps** (`react-native-maps`, Directions, Geocoding) | Teammate 2 |
| Backend / data | **InsForge** (DB + auth + data APIs) | Teammate 2 |
| Orchestrator | **Companion API** (thin Node/Express service) | Teammate 2 |
| AI brain + safety scoring | **Nebius AI Studio** (OpenAI-compatible LLM) | shared (Teammate 2 scores, You wire it as Vapi's brain) |
| Voice | **Vapi** (`@vapi-ai/react-native`) | You (Teammate 3) |

## Architecture

```
┌─────────────────── React Native (Expo) App ───────────────────┐   ← Teammate 1
│  SPLIT SCREEN                                                  │
│  ┌── Top: Google Map ──────┐  ┌── Bottom: Voice Companion ──┐ │
│  │ • current location       │  │ • push-to-talk (Vapi)       │ │
│  │ • crime hotspot heatmap  │  │ • live transcript           │ │
│  │ • safe route polyline    │  │ • safety status chip        │ │
│  └──────────────────────────┘  └─────────────────────────────┘ │
└───────────────┬───────────────────────────┬───────────────────┘
                │ REST (API_CONTRACT.md)      │ voice (Vapi RN SDK)
                ▼                             ▼
        ┌───────────────┐   tool webhook  ┌──────────────┐         ← You
        │ Companion API │◀────────────────│     Vapi     │
        │ (orchestrator)│────results─────▶│ brain=Nebius │
        └──┬────┬────┬──┘                 └──────────────┘
           │    │    │                          ↑ Teammate 2 (scoring) + You (wiring)
   InsForge│ Nebius  │ Google Maps
   DB+auth │ scoring │ Directions/Geocode
           ▲ Teammate 2
```

**The seam that lets 3 people work in parallel is [API_CONTRACT.md](API_CONTRACT.md).** Everyone
codes against it. Teammate 1 builds against mocks of it; Teammate 2 implements it; You call it from Vapi tools.

### How Vapi uses Nebius as its brain (verified detail)

Vapi's `model.provider = "custom-llm"` needs a **streaming `/chat/completions` (SSE) URL**. So you
don't point Vapi straight at Nebius — you host a tiny **`/chat/completions` proxy** (in the Companion
API) that forwards to Nebius's OpenAI-compatible endpoint and streams the response back. Vapi-attached
**tools** then call the `/vapi/tools` webhook. This proxy pattern is Vapi's own recommended approach
and gives us control over the brain. (Details in [prompts/03-vapi-voice-nebius.md](prompts/03-vapi-voice-nebius.md).)

### How map ↔ voice stays in sync (important)

The app is **connected to the live Vapi call** via the RN SDK. When Vapi runs the `find_safe_route`
tool, the result (the chosen route) is delivered back to the connected client through Vapi's
`message` events. The app listens for that and **draws the route on the map**. No extra push channel
needed — the voice call *is* the channel. (Details in each prompt.)

## Suggested repo layout (monorepo)

```
AWS_Hackathon/
├─ app/                  # React Native (Expo)            — Teammate 1
├─ companion-api/        # Node/Express orchestrator       — Teammate 2
├─ data/                 # crime-data ingest scripts        — Teammate 2
├─ vapi/                 # assistant config + tool schemas  — You
├─ prompts/              # the 3 teammate briefs (this dir)
├─ API_CONTRACT.md       # the frozen seam — read this first
└─ README.md
```

## Environment variables (shared `.env` reference — never commit real keys)

```bash
# Companion API base (what the app + Vapi tools call)
COMPANION_API_BASE_URL=http://localhost:8787

# Google Maps
GOOGLE_MAPS_SERVER_KEY=...        # Directions + Geocoding (server-side, in companion-api)
GOOGLE_MAPS_MOBILE_KEY=...        # react-native-maps (restricted to the app bundle id)

# Nebius Token Factory (formerly "AI Studio") — OpenAI-compatible. [verified 2026-06-19]
NEBIUS_API_KEY=...
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/
NEBIUS_MODEL=meta-llama/Llama-3.3-70B-Instruct   # use a FAST instruct model good at tool-calling;
                                                 # avoid R1/reasoning models for low-latency voice. Verify id in catalog.

# InsForge — SDK is @insforge/sdk, createClient({ baseUrl, anonKey }). [verified 2026-06-19]
INSFORGE_BASE_URL=https://your-app.insforge.app
INSFORGE_ANON_KEY=...

# Vapi
VAPI_PRIVATE_KEY=...              # server-side (companion-api webhook auth)
VAPI_PUBLIC_KEY=...               # client (the app)
VAPI_ASSISTANT_ID=...
```

> The values above were **verified against live docs on 2026-06-19** (Context7 + official docs).
> When versions drift, re-confirm with the `get-api-docs` skill / Context7 (`/vapiai/docs`,
> `/insforge/insforge`, `/vapiai/client-sdk-react-native`) rather than guessing.

## Build order (so the demo comes together)

1. **Hour 0–1:** Teammate 2 freezes [API_CONTRACT.md](API_CONTRACT.md) + stands up mock endpoints. Teammate 1 scaffolds the Expo split-screen against mocks. You scaffold the Vapi assistant with stub tools.
2. **Hour 1–4:** Teammate 2 ingests crime data → `hotspots`, implements `/hotspots` + `/safety/score`. Teammate 1 wires the real map + heatmap. You point Vapi's brain at Nebius and connect the call in-app.
3. **Hour 4–7:** Teammate 2 implements `/routes/safe` + Vapi tool webhook. You wire `find_safe_route` and the map-sync event. Teammate 1 renders the route polyline + safety chip from voice events.
4. **Hour 7+:** auth + saved trips (stretch), polish the one golden demo path, rehearse.

## Definition of done (MVP)

- App shows my location + crime heatmap on a real map.
- I can talk to the companion and ask "is this area safe?" → it answers using real data.
- I can ask for a safe route → the safest route draws on the map and the companion explains why.
- One rehearsed end-to-end demo path works reliably offline-of-luck (seeded fallback if an API flakes).
