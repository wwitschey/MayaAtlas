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
feature/phase-12-ingestion

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

Phase 1–4   Infrastructure setup
Phase 5–10  Core map, search, and data model work
Phase 11    Stable clustered map rendering, overlay labels, tile groundwork
Phase 12    Data ingestion workflow and review loop
Phase 13    Deployment

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

Current stable rendering approach:

- clustered GeoJSON source for site points
- separate GeoJSON source for selected site
- HTML overlays for site labels and cluster count text
- OpenStreetMap raster basemap

Functions used:
removeMainSourceAndLayers()
addMainSourceAndLayers()

Use the source rebuild pattern only when structural source behavior changes.

## Label Behavior

MapLibre text layers are intentionally avoided in the stable path.

Reason:

- glyph loading instability
- symbol-layer crashes during dynamic map updates

Use HTML overlays for:

- site labels
- cluster count labels

## Selection Overlay

Selected sites rendered via separate source:
maya-selected-site

This avoids feature-state instability.

## Ingestion Workflow

Primary scripts:

- `scripts/harvest/ingest_open_datasets.py`
- `scripts/harvest/import_open_sites.sh`
- `scripts/harvest/verify_ingestion_fixture.py`

Curated review files:

- `data/curated/open-datasets/review_candidates.csv`
- `data/curated/open-datasets/review_resolutions.csv`

Current ingestion expectations:

1. Run normalization and generate curated CSV output.
2. Review ambiguous candidate pairs.
3. Record durable decisions in `review_resolutions.csv`.
4. Re-run ingestion so those decisions are applied deterministically.
5. Use import-report metrics to confirm idempotent behavior.
