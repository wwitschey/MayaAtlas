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

## Migration Rollout Procedure

Current migration mode is manual and SQL-first. There is no automated migration runner yet, so production rollout should follow a conservative sequence.

### One-Time Setup

1. Provision the production database.
2. Enable `postgis`.
3. Confirm `DATABASE_URL` works from a shell with `psql`.
4. Keep a copy of the exact migration list from [`packages/db/migrations`](/home/wwitschey/MayaAtlas/packages/db/migrations).

### First Production Bootstrap

Run the migrations in filename order:

```bash
for file in packages/db/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
```

Then verify:

1. Core tables exist.
2. Seed data like periods and layers exists.
3. `/health` responds after the API starts.
4. `/api/sites` and `/api/layers` return expected results.

### Incremental Production Release

For a normal deploy with new migrations:

1. Review the new SQL files in the PR or branch diff.
2. Take a managed database backup or snapshot before running them.
3. Put the API deployment on hold until migrations finish successfully.
4. Run only the new migration files, in numeric order, with `ON_ERROR_STOP=1`.
5. Start or resume the API deployment after migrations succeed.
6. Run the post-deploy smoke checks.

Example incremental run:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/migrations/020_example.sql
```

### Rollback Expectations

Current rollback strategy is restore-first, not down-migrations:

- if a migration fails before commit, fix the SQL and rerun
- if a migration partially applies or produces bad state, restore from the pre-migration backup or snapshot
- if the schema succeeds but the app is unhealthy, roll back the application deployment first and then decide whether DB restore is necessary

Because this repo does not yet maintain reversible down-migrations, do not treat production migration rollback as automatic.

### Operational Checks After Migration

1. Confirm the API process starts cleanly with production env vars.
2. Confirm `/health` returns `{"ok": true}`.
3. Confirm `/api/layers` returns layer definitions.
4. Confirm `/api/sites?limit=5` returns rows.
5. Open the deployed frontend and confirm the map loads.
6. Click a site and confirm the site drawer opens.
7. If ingestion-related migrations changed, rerun the ingestion fixture locally before the next content import.

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

## Staging-Like Smoke Test

Before the first public production release, run one staging-like deployment cycle using the same provider assumptions and production-style environment values.

### Goal

Prove that:

- the API boots with production env validation enabled
- the web app points at the deployed API correctly
- migrations can be applied safely before app traffic
- the core map and site-detail flow work end to end

### Recommended Staging Inputs

Use staging-style values, not localhost values:

- `DATABASE_URL` pointing at a non-local Postgres/PostGIS instance
- `API_CORS_ORIGINS` set to the staging frontend origin
- `API_PUBLIC_ORIGIN` set to the staging API origin
- `NEXT_PUBLIC_API_BASE_URL` set to the staging API origin

Example shape:

```text
API_CORS_ORIGINS=https://staging.maya-atlas-web.example
API_PUBLIC_ORIGIN=https://staging.maya-atlas-api.example
NEXT_PUBLIC_API_BASE_URL=https://staging.maya-atlas-api.example
```

### Run Order

1. Provision the staging database.
2. Enable `postgis`.
3. Apply migrations in numeric order.
4. Deploy the API with staging env vars.
5. Confirm `/health` is green.
6. Deploy the web app with `NEXT_PUBLIC_API_BASE_URL` pointed at staging API.
7. Run the smoke checks below.

### Smoke Checks

API checks:

1. `GET /health` returns `200` with `{"ok": true}`
2. `GET /api/layers` returns JSON
3. `GET /api/sites?limit=5` returns rows
4. `GET /api/search/sites?q=tikal` returns JSON without server error

Frontend checks:

1. Frontend root page loads without a fatal runtime error
2. Base map renders
3. Site points render
4. Period filter changes visible results
5. Search can select a site
6. Clicking a site opens the drawer
7. Optional terrain controls render and toggle without crashing the map

Cross-origin checks:

1. Browser network requests to the API succeed from the staging frontend origin
2. No CORS errors in console for `/api/sites`, `/api/layers`, or `/api/search/sites`

### Pass Criteria

Treat the staging smoke test as passing only if:

- migrations complete without manual DB repair
- API health and core JSON endpoints work
- frontend map and site-detail interactions work
- no blocking console errors appear during normal use
- CORS is correct for the staging frontend origin

### If It Fails

Use this order:

1. Fix environment/config issues first
2. Then fix migration-order or DB-state issues
3. Then fix app/runtime regressions
4. Rerun the full smoke sequence, not just the failed single step

## Current Deployment Gaps

This is the current remaining audit list for Phase 13:

- no automated migration runner yet
- no documented CDN or object-storage strategy for future tile assets yet
- no explicit process manager or container definition yet

## Recommended Next Steps

1. Provision Vercel and Render services using the settings above.
2. Run the migration rollout procedure in a staging-like environment.
3. Execute the staging-like smoke test above.
4. Decide whether to add an automated migration wrapper.
5. Document any provider-specific issues discovered during staging.
