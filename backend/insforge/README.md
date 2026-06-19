# InsForge setup — Guardian crime data

Per the team brief, **InsForge** holds geo-queryable crime data in a `hotspots` table. The backend reads from InsForge when configured; otherwise it falls back to a local seed file.

## 1. Create / link an InsForge project

**From the repo root** (`aws-hack/`), not `backend/`:

```bash
# New project in a new or existing org (interactive)
npx @insforge/cli create

# Or link an existing project you already created in the dashboard
npx @insforge/cli link --project-id <your-project-id>

npx @insforge/cli current   # verify URL + keys
```

This writes:

- `.insforge/project.json` — project URL + admin API key (CLI + ingest)
- `.env.local` — anon key for the app (`NEXT_PUBLIC_INSFORGE_*`)

The backend auto-loads both files; you usually do **not** need to duplicate keys in `backend/.env`.

### Switch to a different org / project

1. Run `npx @insforge/cli create` and pick the **new org**, or `npx @insforge/cli link --project-id <id>` for an existing project.
2. Confirm: `npx @insforge/cli current --json`
3. Import schema (step 2 below) — tables are empty on a fresh project.
4. Ingest crime data (step 4 below).

Old project data is **not** migrated; the new project starts empty.

## 2. Create tables

**Run from repo root** (InsForge link lives here, not in `backend/`):

```bash
# from aws-hack/
npx @insforge/cli db import backend/insforge/schema.sql

npx @insforge/cli db tables   # verify hotspots, profiles, trips
```

If you see `No project linked`, run commands from the **repo root**, not `backend/`.

## 3. Configure backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
USE_MOCK=false
INSFORGE_URL=https://your-app.insforge.app
INSFORGE_ANON_KEY=your-anon-key
INSFORGE_API_KEY=your-admin-api-key
```

## 4. Ingest CSV → InsForge

Place the SFPD CSV in `data/` (see `data/README.md`). Then:

```bash
cd backend

# Full upload (all valid SF incidents, replaces existing rows)
cd backend && source .venv/bin/activate
python scripts/ingest_hotspots.py --all --replace

# Smaller loads
python scripts/ingest_hotspots.py --limit 15000
python scripts/ingest_hotspots.py --limit 100000

# Local seed only (no InsForge)
python scripts/ingest_hotspots.py --seed-only --limit 15000
```

`ingest_hotspots.py` (without `--seed-only`) will:

1. Parse the CSV → normalize `category`, `severity` (1–5), `occurred_at`
2. Write `backend/data/seed-hotspots.json` (fallback cache)
3. Batch-insert into InsForge `hotspots` (500 rows per request)

## 5. Run API against InsForge

```bash
cd backend
source .venv/bin/activate
USE_MOCK=false uvicorn guardian.main:app --reload --port 3001
```

Test:

```bash
curl "http://localhost:3001/hotspots?lat=37.7749&lng=-122.4194&radius=500"
```

## Table shape

| Column        | Type        | Notes                          |
|---------------|-------------|--------------------------------|
| `id`          | UUID        | auto                           |
| `lat` / `lng` | float       | SF incidents only after filter   |
| `category`    | text        | e.g. ASSAULT, ROBBERY          |
| `severity`    | 1–5         | mapped centrally in ingest       |
| `occurred_at` | timestamptz | from CSV date                  |
| `source`      | text        | `sfpd`                         |

## Notes

- The full CSV is **~500MB** — keep it local (`data/*.csv` is gitignored). Use `--limit` for hackathon demos.
- Ingest uses **admin API key** (`createAdminClient`) so inserts bypass RLS.
- `GET /hotspots` queries with a lat/lng bounding box; `weight` is computed at read time in the API.
