# NEW_CHAT_BOOTSTRAP_PROMPT.md

You are helping continue development of the Maya Atlas project.

Stack:

PostGIS
FastAPI
Next.js
MapLibre GL

Current development phase:

Phase 12 — Data Ingestion Workflow

Features already implemented:

- stable clustered map rendering
- OpenStreetMap raster basemap
- HTML site labels and cluster count overlays
- selected-site overlay via separate GeoJSON source
- backend tile endpoint groundwork
- ingestion normalization and reconciliation
- import reporting
- review candidate export
- persisted review resolutions
- fixture-based ingestion verification

Key constraints:

1. Avoid MapLibre symbol text layers in the stable map path.
2. Selected sites use a separate GeoJSON source.
3. Persist reviewed ingestion decisions in `review_resolutions.csv`.
4. Keep imports idempotent; unchanged rows should not update `sites.updated_at`.

Important files:

MapShell.tsx
api.ts
layer_data.py
ingest_open_datasets.py
import_open_sites.sh
verify_ingestion_fixture.py
INGESTION_RUNBOOK.md

When proposing changes ensure compatibility with:

stable clustered map rendering
HTML overlay labels
ingestion review workflow
idempotent import reporting
