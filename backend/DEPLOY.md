# Deploy Guardian API to InsForge Compute

Production URL:

**https://guardian-api-56fc0b01-f766-43e0-b6d5-55a5611208cf.fly.dev**

InsForge Postgres (hotspots) stays on `https://3pxuvez4.us-east.insforge.app` — the API reads it via `INSFORGE_API_KEY`.

## Redeploy

```bash
export PATH="$HOME/.fly/bin:$PATH"

# Merge local secrets + production overrides (do not commit /tmp/guardian-deploy.env)
{
  cat backend/.env
  cat backend/.env.compute
  python3 -c "import json; p=json.load(open('.insforge/project.json')); print('INSFORGE_API_KEY='+p['api_key'])"
} > /tmp/guardian-deploy.env

npx @insforge/cli compute deploy backend \
  --name guardian-api \
  --port 8080 \
  --env-file /tmp/guardian-deploy.env \
  --region iad \
  --memory 1024
```

## Point clients at the deployed API

| Client | Env var | Value |
|--------|---------|--------|
| Web (`frontend/web`) | `VITE_API_URL` | `https://guardian-api-56fc0b01-f766-43e0-b6d5-55a5611208cf.fly.dev` |
| Mobile (`frontend`) | `EXPO_PUBLIC_COMPANION_API_BASE_URL` | same URL |
| Vapi assistant | `COMPANION_API_BASE_URL` | same URL (tool webhooks) |

## Ops

```bash
npx @insforge/cli compute list
npx @insforge/cli compute logs guardian-api
npx @insforge/cli compute update 6b1f98d5-95ad-447c-81e3-75fbfb8425b6 --env-set NEBIUS_MODEL=Qwen/Qwen3-32B-Instruct-fast
```

Cold start: Fly machines may sleep when idle (~1s wake on first request).
