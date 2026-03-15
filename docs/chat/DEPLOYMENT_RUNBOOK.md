# DEPLOYMENT_RUNBOOK.md

## Purpose

This runbook defines the current deployment contract for Maya Atlas as Phase 13 begins.

It does not lock the project to a specific hosting provider yet. Instead, it captures the minimum environment, startup, and verification requirements needed to deploy the existing stack safely.

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
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_TERRAIN_TILES_URL`
- `NEXT_PUBLIC_TERRAIN_ENCODING`
- `NEXT_PUBLIC_TERRAIN_TILE_SIZE`

Notes:

- `DATABASE_URL` is required for the API
- `API_CORS_ORIGINS` should be set explicitly in production and should not remain localhost-only
- `NEXT_PUBLIC_API_BASE_URL` must point the frontend at the deployed API origin
- terrain variables are optional because the frontend has a public DEM default

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

This is the starting audit list for Phase 13:

- no provider-specific deployment config yet
- no automated migration runner yet
- no production-specific env validation yet
- no documented CDN or object-storage strategy for future tile assets yet
- no explicit process manager or container definition yet

## Recommended Next Steps

1. Choose the first deployment target for web, API, and database hosting.
2. Add provider-specific config files.
3. Add production env validation.
4. Define the migration rollout procedure.
5. Document rollback and operational checks.
