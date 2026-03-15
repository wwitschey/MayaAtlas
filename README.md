# Maya Atlas

Maya Atlas is a web GIS for Maya archaeological sites.

The project currently includes:

- a Next.js map frontend
- a FastAPI API
- a PostgreSQL/PostGIS database
- a curated open-dataset ingestion pipeline
- stable clustered site rendering with HTML label overlays
- optional hillshade and 3D terrain controls

## Stack

- Next.js + TypeScript frontend
- FastAPI backend
- PostgreSQL + PostGIS database
- SQL migrations in `packages/db/migrations`

## Current Features

- clustered site rendering on top of an OpenStreetMap raster basemap
- period-based site filtering
- selected-site drawer and popup flow
- optional `Hillshade` and `3D Terrain` map controls
- open-dataset ingestion from OpenStreetMap, Wikidata, and Wayeb GIS Atlas
- review-candidate and review-resolution workflow for ambiguous site matches
- idempotent SQL import reporting

## Repo Layout

- `apps/web` — Next.js frontend
- `apps/api` — FastAPI backend
- `packages/db/migrations` — SQL migrations
- `scripts/harvest` — ingestion and harvest scripts
- `docs` — development plan and operator docs

## Local setup

### 1. Copy env vars
```bash
cp .env.example .env
```

### 2. Start PostgreSQL/PostGIS
Use a local PostgreSQL instance with PostGIS enabled and create a database named `maya_atlas`.

### 3. Run migrations
Apply the SQL files in `packages/db/migrations` in numeric order.

### 4. Run the API
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 5. Run the web app
```bash
pnpm install
pnpm dev:web
```

The frontend defaults to `http://localhost:3000` and the API to `http://localhost:8000`.

## Ingestion Workflow

The ingestion pipeline entrypoint is:

```bash
python3 scripts/harvest/ingest_open_datasets.py --skip-harvest
```

Useful related files:

- `scripts/harvest/verify_ingestion_fixture.py`
- `data/curated/open-datasets/review_candidates.csv`
- `data/curated/open-datasets/review_resolutions.csv`

Detailed operator instructions live in:

- `docs/chat/INGESTION_RUNBOOK.md`

## Deployment Notes

The deployment contract and current Phase 13 audit notes live in:

- `docs/chat/DEPLOYMENT_RUNBOOK.md`

Development and deployment environment variables are documented in:

- `.env.example`

## Current Data Sources

The curated open-dataset pipeline currently draws from:

- `OpenStreetMap`
  - harvested with Overpass from Maya-region archaeological-site and ruins features
  - useful for broad coverage and named local features

- `Wikidata`
  - harvested from the Wikidata Query Service for archaeological sites in the Maya-region bounding box
  - useful for canonical names and cross-reference coverage

- `Wayeb GIS Atlas`
  - harvested from Wayeb's public KML for the Atlas of Maya Archaeological Sites
  - adds a Maya-focused site inventory that materially expands coverage

These sources are normalized into:

- `data/curated/open-datasets/sites_normalized.csv`

Ambiguous matches are surfaced in:

- `data/curated/open-datasets/review_candidates.csv`

Persisted editorial decisions are stored in:

- `data/curated/open-datasets/review_resolutions.csv`

Notes:

- the pipeline is designed to produce a curated canonical dataset rather than exposing raw source records directly
- provenance is preserved through imported source records and site-source links
- Witschey-Brown-derived public metadata has been investigated, but no openly ingestible bulk file is currently wired into the pipeline

## Map Notes

The stable map path intentionally avoids MapLibre symbol text layers for site labels.
Site labels and cluster count labels are rendered as HTML overlays to avoid glyph and symbol-layer instability.

Terrain is optional:

- `Hillshade` enables the hillshade overlay
- `3D Terrain` enables terrain extrusion at higher zoom

The frontend uses a public DEM source by default, but you can override it with:

- `NEXT_PUBLIC_TERRAIN_TILES_URL`
- `NEXT_PUBLIC_TERRAIN_ENCODING`
- `NEXT_PUBLIC_TERRAIN_TILE_SIZE`
