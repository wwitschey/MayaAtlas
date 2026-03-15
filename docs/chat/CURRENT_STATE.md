# CURRENT_STATE.md

## Project Status

Current phase:
Phase 8.5 — Spatial tile caching

## Working Features

MapLibre map supports:
- pan
- zoom
- marker click
- popup
- fly-to
- search
- clustering
- time period filter

## Data Sources

Open datasets used:

OpenStreetMap
Wikidata

Observed counts during testing (approx):
OpenStreetMap ~522
Wikidata ~325

Needs verification with latest dataset import.

## Backend API

Endpoints:

GET /api/sites
GET /api/sites/{slug}
GET /api/search/sites

Supports parameters:

bbox
period
limit

Example:

/api/sites?bbox=west,south,east,north&period=Late Classic

## Temporal Filtering

Stored in:
site_temporal_assertions

Columns:

period_label
start_year
end_year
certainty

Example entry:
Tikal → Late Classic

Filtering executed server-side using SQL EXISTS.

## Tile Cache

Client-side cache implemented.

Cache key:
z/x/y | period

Stored in:
tileCacheRef

Tiles merged before rendering.

## Refresh Behavior

Map refresh occurs on:
moveend
period change

Tile cache prevents redundant API calls.

## Next Planned Phase

Phase 9 — Historical layers

Planned additions:
- Maya regional polygons
- terrain layers
- improved site metadata
