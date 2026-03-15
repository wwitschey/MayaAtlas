# PROJECT_WORKFLOW.md

## Purpose
Defines the development workflow used for the Maya Atlas project.

## Branch Strategy
Development occurs in feature branches:

main
feature/<feature-name>

Example branches used:
feature/witschey-brown-ingest
feature/spatial-tile-caching

Typical flow:
git checkout main
git pull
git checkout -b feature/<name>

When complete:
git add .
git commit -m "<description>"
git push -u origin feature/<name>

Then merge into main.

## Development Phases

Phase 1–4  Infrastructure setup (repo, DB, API, Next.js)
Phase 5    MapLibre map + site markers
Phase 6    Witschey/Brown dataset ingestion
Phase 7    Viewport-driven loading
Phase 8    Temporal filtering
Phase 8.5  Spatial tile caching
Phase 9    Historical layers (future)

## Backend Workflow

DB migrations located in:
packages/db/migrations/

Run via:
psql $DATABASE_URL -f migration.sql

### Python API
FastAPI service.

Routes:
/api/sites
/api/sites/{slug}
/api/search/sites

Run:
uvicorn app.main:app --reload

## Frontend Workflow

Stack:
Next.js
TypeScript
MapLibre GL

Run:
pnpm dev:web

## MapLibre Development Rules

Source lifecycle when refreshing data:

1. Remove layers
2. Remove source
3. Recreate source
4. Re-add layers

Functions used:
removeMainSourceAndLayers()
addMainSourceAndLayers()

## Cluster Behavior

Clusters enabled only when no time filter:

clustered = !period

## Selection Overlay

Selected sites rendered via separate source:
maya-selected-site

This avoids feature-state instability.

## Viewport Refresh Strategy

Refresh occurs on:

map.on("moveend")

But is:
- debounced
- deduplicated by viewport key

## Tile Cache Strategy

Client-side spatial tile caching.

Cache key:
z/x/y | period

Tile results merged client-side.
