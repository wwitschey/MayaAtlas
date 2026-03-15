# SESSION_HANDOFF_TEMPLATE.md

# Maya Atlas Session Handoff

## Branch

feature/<branch-name>

## Phase

Phase <number> — <phase name>

## Completed Work

Describe what was implemented.

Example:

Added spatial tile caching
Improved viewport refresh behavior
Added ingestion review resolution support

## Files Modified

Example:

MapShell.tsx
tiles.ts
api.ts
scripts/harvest/ingest_open_datasets.py

## Commands Verified

List the commands that were run successfully.

Example:

python3 scripts/harvest/verify_ingestion_fixture.py
python3 scripts/harvest/ingest_open_datasets.py --skip-harvest --skip-import

## Data Artifacts Changed

List any generated or curated files that changed.

Example:

data/curated/open-datasets/sites_normalized.csv
data/curated/open-datasets/review_candidates.csv
data/curated/open-datasets/review_resolutions.csv

## Architecture Changes

Explain structural changes.

Example:

Added slippy-map tile caching for spatial queries.
Moved site labels to HTML overlays.
Added persisted ingestion review resolutions.

## Known Issues

Document bugs or unstable behaviors.

Example:

PMTiles still not implemented.
MapLibre symbol text remains intentionally avoided in the stable map path.

## Next Steps

Example:

Add Maya regional boundary layers
Document or resolve remaining review candidates
Prepare deployment plan for Phase 13

## Notes for Next Chat

Add any context needed to resume work.

Recommended context:

- current branch name
- latest commit hash
- whether generated files like `apps/web/tsconfig.tsbuildinfo` were intentionally excluded
- whether a DB import was run and what the final import metrics were
