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

A **Vite web UI** (`frontend/web/`) provides the full map + route comparison in the browser for local demos.

## Repo layout (this monorepo)

```
aws-hack/
├── API_CONTRACT.md   ← frozen seam — read this first
├── README.md
├── backend/          ← Node/Express Companion API (:3001), crime ingest, Vapi webhook, Nebius proxy
├── frontend/         ← Expo mobile app (root) + Vite web map UI (web/)
└── data/             ← SFPD historical crime CSV (+ backend ingest scripts under backend/data/)
```

**The seam that lets the team work in parallel is [API_CONTRACT.md](API_CONTRACT.md).** Everyone codes against it. The Expo app can use mocks until the API is live; the backend implements it; Vapi tools call a subset of it.

## Quick start — backend + web map

**Terminal 1 — backend**

```bash
cd backend && npm install && npm run dev   # http://localhost:3001
```

**Terminal 2 — web map UI**

```bash
cd frontend && npm run web:install && npm run web:dev   # http://localhost:5173
```

Open http://localhost:5173 — map, crime heatmap, route comparison. The dev server proxies `/api` → `http://localhost:3001`.

**Crime data ingest** (optional, for live mode):

```bash
cd backend
npm run ingest -- --seed-only
USE_MOCK=false npm run dev
```

## Quick start — Expo mobile

```bash
cd frontend && npm install && npx expo start
```

Point the app at `EXPO_PUBLIC_COMPANION_API_BASE_URL` (see `frontend/.env.example`). Use mocks in `frontend/mocks/` when the API is offline.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Mobile app | **React Native (Expo)** | `frontend/` |
| Web map UI | **React + Vite** | `frontend/web/` |
| Map + routing | **Google Maps** | Directions, Geocoding (server in `backend/`) |
| Orchestrator | **Companion API** | `backend/` (Node/Express) |
| AI brain + safety scoring | **Nebius** (OpenAI-compatible LLM) | scoring + explanations; `/chat/completions` proxy |
| Voice | **Vapi** (`@vapi-ai/react-native`) | `frontend/` |

## Architecture

```
┌─────────────────── React Native (Expo) — frontend/ ───────────┐
│  SPLIT SCREEN: map + crime heatmap + safe route + voice (Vapi) │
└───────────────┬───────────────────────────┬───────────────────┘
                │ REST (API_CONTRACT.md)      │ Vapi RN SDK
                ▼                             ▼
        ┌───────────────┐   tool webhook  ┌──────────────┐
        │ Companion API │◀────────────────│     Vapi     │
        │   backend/    │────results─────▶│ brain=Nebius │
        └──┬────┬────┬──┘                 └──────────────┘
           │    │    │
      data │ Nebius  │ Google Maps
           │ scoring │ Directions/Geocode

┌────────────── frontend/web/ (Vite) ──────────────┐
│  Browser map UI — same REST API via /api proxy │
└──────────────────────────────────────────────────┘
```

### Vapi + Nebius

Vapi's `model.provider = "custom-llm"` needs a streaming `/chat/completions` (SSE) URL. The Companion API in `backend/` forwards to Nebius. Vapi **tools** call `POST /vapi/tools`. See [API_CONTRACT.md](API_CONTRACT.md) and team prompts (if present locally under `prompts/`).

### Map ↔ voice sync

When `find_safe_route` runs, the app listens for Vapi `message` events and re-calls `POST /routes/safe` to draw `routes[0]` on the map (see contract for details).

## Environment variables

Never commit real keys. See `backend/.env.example` and `frontend/.env.example`.

```bash
# Companion API (app + Vapi tools + web proxy)
COMPANION_API_BASE_URL=http://localhost:3001

# Google Maps — server key in backend; mobile key restricted to app bundle id
GOOGLE_MAPS_SERVER_KEY=...

# Nebius Token Factory
NEBIUS_API_KEY=...
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1/

# Vapi
VAPI_PRIVATE_KEY=...
VAPI_PUBLIC_KEY=...
```

## Demo city

San Francisco — SFPD historical incident reports (2003–2018) in `data/`.

## Definition of done (MVP)

- App shows my location + crime heatmap on a real map.
- I can talk to the companion and ask "is this area safe?" → it answers using real data.
- I can ask for a safe route → the safest route draws on the map and the companion explains why.
- One rehearsed end-to-end demo path works reliably (seeded fallback if an API flakes).
