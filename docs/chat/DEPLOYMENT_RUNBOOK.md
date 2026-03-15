# DEPLOYMENT_RUNBOOK.md

## Purpose

This runbook defines the current deployment contract for Maya Atlas as Phase 13 begins.

The recommended first production target is:

- `Vercel` for `apps/web`
- `Render` for `apps/api`
- `Render Postgres` with `postgis`

## Components

Current deployable services:

- `apps/web` — Next.js frontend
- `apps/api` — FastAPI backend
- PostgreSQL with PostGIS enabled

Supporting assets:

- SQL migrations in `packages/db/migrations`
- curated ingestion artifacts under `data/curated/open-datasets`

## Required Environment Variables

Defined in:

- `.env.example`

Current variables:

- `DATABASE_URL`
- `API_HOST`
- `API_PORT`
- `API_CORS_ORIGINS`
- `API_PUBLIC_ORIGIN`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_TERRAIN_TILES_URL`
- `NEXT_PUBLIC_TERRAIN_ENCODING`
- `NEXT_PUBLIC_TERRAIN_TILE_SIZE`

Notes:

- `DATABASE_URL` is required for the API
- `API_CORS_ORIGINS` should be set explicitly in production and should not remain localhost-only
- `API_PUBLIC_ORIGIN` should be set to the deployed API origin for operational clarity and future absolute URL needs
- `NEXT_PUBLIC_API_BASE_URL` must point the frontend at the deployed API origin
- terrain variables are optional because the frontend has a public DEM default

## Recommended Provider Setup

### Frontend: Vercel

- Root directory: `apps/web`
- Install command: `pnpm install`
- Build command: `pnpm build`
- Output: Next.js default

Required Vercel env vars:

- `NEXT_PUBLIC_API_BASE_URL`
- optionally `NEXT_PUBLIC_TERRAIN_TILES_URL`
- optionally `NEXT_PUBLIC_TERRAIN_ENCODING`
- optionally `NEXT_PUBLIC_TERRAIN_TILE_SIZE`

### API: Render

- The repo includes [`render.yaml`](/home/wwitschey/MayaAtlas/render.yaml) for the first API/database deployment path.
- Render web service root directory: `apps/api`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

Required Render env vars:

- `DATABASE_URL`
- `API_CORS_ORIGINS`
- `API_PUBLIC_ORIGIN`

### Database: Render Postgres

- Provision a Render Postgres instance
- enable `postgis`
- apply migrations from `packages/db/migrations` in numeric order before first production traffic

## Startup Commands

API:

```bash
cd apps/api
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Web:

```bash
cd apps/web
pnpm build
pnpm start
```

Recommended hosted commands for the first production stack:

- Vercel web build: `pnpm build`
- Render API start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Database Setup

1. Provision PostgreSQL.
2. Enable PostGIS.
3. Apply migrations from `packages/db/migrations` in numeric order.
4. Confirm the API can connect using `DATABASE_URL`.

## Health Checks

Current API health endpoint:

```text
/health
```

Expected response:

```json
{"ok": true}
```

Recommended manual checks after deployment:

1. Open the frontend root page.
2. Confirm the map loads.
3. Confirm `/api/sites` responds.
4. Confirm `/api/search/sites` responds.
5. Confirm `/health` returns `{"ok": true}`.
6. Confirm the site drawer opens from a map click.

## Current Deployment Gaps

This is the current remaining audit list for Phase 13:

- no automated migration runner yet
- no production-specific env validation yet
- no documented CDN or object-storage strategy for future tile assets yet
- no explicit process manager or container definition yet

## Recommended Next Steps

1. Provision Vercel and Render services using the settings above.
2. Add production env validation.
3. Define the migration rollout procedure.
4. Document rollback and operational checks.
5. Run the first staging-like deployment smoke test.
