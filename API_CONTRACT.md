# API Contract — the frozen seam

> **Everyone codes against this.** Teammate 1 (UI) consumes it via mocks until it's live.
> Teammate 2 (backend) implements it. You (Vapi) call a subset of it from voice tools.
> If you need to change a shape, announce it in the team chat and update this file — it is the single source of truth.

All endpoints are served by the **Companion API** at `COMPANION_API_BASE_URL`.
JSON in, JSON out. Auth (once added) = `Authorization: Bearer <insforge-jwt>`; during early
build, auth is optional and endpoints work unauthenticated.

**Scoring convention (read this once):** `safetyScore` is **0–100 where 100 = safest**.
`riskLevel` is the human bucket derived from it.

```
safetyScore  riskLevel
80–100       "safe"
60–79        "caution"
40–59        "risky"
 0–39        "dangerous"
```

---

## 1. `GET /hotspots`

Crime hotspots near a point. Used by the **map heatmap** and by the scorer.

**Query:** `lat` (float), `lng` (float), `radius` (meters, default 1500)

**200:**
```json
{
  "hotspots": [
    {
      "id": "hs_123",
      "lat": 40.7128,
      "lng": -74.0060,
      "category": "assault",
      "severity": 4,           // 1..5
      "recencyDays": 12,       // days since incident
      "count": 7,              // incidents aggregated at this point
      "weight": 0.82           // 0..1 normalized contribution (for heatmap intensity)
    }
  ]
}
```

---

## 2. `POST /safety/score`

Safety of a single location. Backend aggregates nearby hotspots → score, then asks **Nebius**
to write the one-line `explanation`. Used by the voice tool `get_area_safety` and the safety chip.

**Body:** `{ "lat": 40.71, "lng": -74.00, "radius": 800 }`

**200:**
```json
{
  "safetyScore": 63,
  "riskLevel": "caution",
  "explanation": "Generally okay, but there have been recent thefts two blocks north.",
  "topHotspots": [ /* up to 3 hotspot objects as above */ ]
}
```

---

## 3. `POST /routes/safe`  ⭐ the hero endpoint

Returns candidate routes **sorted safest-first**. Backend: Google Directions (with
`alternatives=true`) → scores each route against hotspots along its polyline → Nebius writes
each `explanation`. Used by the voice tool `find_safe_route` and drawn on the map.

**Body:**
```json
{
  "origin":      { "lat": 40.71, "lng": -74.00 },   // OR a string like "Times Square"
  "destination": "Grand Central Station",            // string or {lat,lng}
  "mode": "walking"                                  // walking|driving|transit|bicycling
}
```

**200:** (`routes[0]` is the recommended safest route)
```json
{
  "routes": [
    {
      "id": "rt_a",
      "summary": "via Park Ave",
      "polyline": "encodedPolylineString",   // Google encoded polyline
      "distanceMeters": 1420,
      "durationSeconds": 1080,
      "safetyScore": 81,
      "riskLevel": "safe",
      "explanation": "Avoids the high-crime block on 5th St; 3 min longer but much safer.",
      "avoidedHotspots": [ /* hotspot objects this route stays clear of */ ]
    }
  ]
}
```

---

## 4. `POST /geocode` (helper)

`{ "query": "Grand Central" }` → `{ "lat": 40.75, "lng": -73.97, "formattedAddress": "..." }`
(Voice tools may pass place names; backend can also geocode internally inside `/routes/safe`.)

---

## 5. Auth + Trips (InsForge-backed — stretch, but contract is fixed now)

- `POST /auth/signup` `{email,password}` → `{ token, user }`  *(thin wrapper over InsForge auth)*
- `POST /auth/login`  `{email,password}` → `{ token, user }`
- `GET  /trips` → `{ trips: [ { id, name, origin, destination, mode, createdAt } ] }`
- `POST /trips` `{ name, origin, destination, mode }` → `{ trip }`

---

## 6. `POST /vapi/tools`  — Vapi tool webhook (You ⇄ Teammate 2 co-own)

Vapi calls this when the assistant invokes a tool. Backend dispatches to the endpoints above
and returns the tool result. **You define the tool schemas; Teammate 2 implements the dispatch.**

**Vapi → Companion API** (shape simplified; confirm exact Vapi payload in their docs):
```json
{ "message": { "type": "tool-calls",
  "toolCalls": [ { "id": "call_1", "function": { "name": "find_safe_route",
    "arguments": { "origin": "here", "destination": "Grand Central", "mode": "walking" } } } ] } }
```

**Companion API → Vapi** (results array, one per toolCall id). [verified against Vapi docs 2026-06-19]
Each result requires `name` + `toolCallId` + `result` (a JSON **string**); optional top-level
`message.content` is spoken to the user:
```json
{ "results": [ { "name": "find_safe_route", "toolCallId": "call_1",
  "result": "{\"routes\":[{\"summary\":\"via Park Ave\",\"safetyScore\":81,\"durationSeconds\":1080,\"explanation\":\"...\"}]}" } ],
  "message": { "content": "I found a safer route that adds about three minutes." } }
```

### The three tools (1:1 with the endpoints)

| Tool | Args | Calls | Returns to the model |
|---|---|---|---|
| `get_area_safety` | `{ lat, lng }` | `POST /safety/score` | safetyScore, riskLevel, explanation |
| `list_nearby_hotspots` | `{ lat, lng, radius }` | `GET /hotspots` | count + top categories |
| `find_safe_route` | `{ origin, destination, mode }` | `POST /routes/safe` | safest route summary + explanation |

### Map sync (the wow)

When `find_safe_route` runs, the route also reaches the **app** because the app is in the live Vapi
call. Subscribe the client to tool-call messages and listen: [verified against Vapi SDK docs 2026-06-19]

```ts
vapi.on('message', (m) => {
  if (m.type === 'tool-calls') {
    for (const tc of m.toolCallList) {            // m.toolCallList, each tc.function.{name,arguments}
      if (tc.function?.name === 'find_safe_route') {
        const args = typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        // draw it: re-call POST /routes/safe with args, then render routes[0].polyline
      }
    }
  }
});
```

The client `tool-calls` event carries the **arguments** (origin/destination/mode), not the backend
result — so the simplest reliable sync is: on that event the app **re-calls `POST /routes/safe`**
itself and draws `routes[0].polyline` + highlights `avoidedHotspots`. The voice (server-side webhook)
and the map (client re-fetch) run off the same tool call, so they stay in sync.

> Alternatives if you want the map to update without a re-fetch: (a) **InsForge realtime** — backend
> publishes the chosen route to a channel the app is subscribed to; or (b) have the assistant speak a
> compact route summary the app parses. Re-fetch is the least fragile for a hackathon.

---

## Companion API extensions (implemented in `backend/` — local port `3001`)

These endpoints exist in the monorepo Node backend and are not required for the Expo mocks, but the web UI and Vapi Nebius proxy depend on them.

### `GET /health`

```json
{ "status": "ok", "version": "0.1.0", "mode": "mock" | "live" }
```

### `POST /chat/completions`

OpenAI-compatible proxy → Nebius Token Factory. **Must stream SSE.**

**Request:** standard OpenAI chat completion body (`model`, `messages`, `stream: true`).

**Response:** `text/event-stream` with OpenAI-style chunks:

```
data: {"id":"...","choices":[{"delta":{"content":"Hello"}}]}

data: [DONE]
```
