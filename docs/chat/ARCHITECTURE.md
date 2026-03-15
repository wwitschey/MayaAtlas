# ARCHITECTURE.md

## Overview

Maya Atlas is a web GIS for Maya archaeological sites.

Architecture:

PostgreSQL + PostGIS
↓
FastAPI backend
↓
Next.js frontend
↓
MapLibre GL rendering

Current stable map path:

OpenStreetMap raster basemap
↓
GeoJSON site source with MapLibre clustering
↓
HTML overlays for site labels and cluster counts

## Database

Primary tables:

sites
site_aliases
site_temporal_assertions
sources
site_source_links

Views:

site_summary_v

## API Layer

Example site response:

{
 id,
 slug,
 display_name,
 canonical_name,
 site_type,
 country_code,
 longitude,
 latitude
}

## Frontend Components

Key files:

MapShell.tsx
SiteDrawer.tsx
SearchBox.tsx
PeriodFilter.tsx

## MapLibre Sources

Main source:
maya-sites

Selection source:
maya-selected-site

Layers:

maya-sites-clusters
maya-sites-circles
maya-selected-site-circle

HTML overlays:

site labels
cluster count text

## Source Lifecycle

The stable map flow uses a clustered GeoJSON source and a separate selection source.

When the main site source needs structural changes, the app performs:

removeMainSourceAndLayers()
addMainSourceAndLayers()
wireClusterClick()

Prevents MapLibre internal state errors.

## Temporal Filtering

Server-side filtering using period parameter.

Frontend request:

period=<label>

Current implementation keeps the stable GeoJSON rendering path and applies period-aware data loading.

## API Data Path

Current stable frontend path:

- `/api/sites`
- viewport-aware site loading
- clustered GeoJSON rendering in the browser

Backend work already present for future tile-native architecture:

- `/api/layers/{id}/tiles/{z}/{x}/{y}.pbf`
- server-side tile response and CORS handling

## Ingestion Pipeline

Core scripts:

scripts/harvest/ingest_open_datasets.py
scripts/harvest/import_open_sites.sh
scripts/harvest/verify_ingestion_fixture.py

Curated artifacts:

data/curated/open-datasets/sites_normalized.csv
data/curated/open-datasets/review_candidates.csv
data/curated/open-datasets/review_resolutions.csv

Current ingestion stages:

1. raw harvest reuse or refresh
2. normalization and conservative dedupe
3. review candidate export
4. review resolution application
5. SQL import with created/updated/unchanged reporting

## Selection System

Selected site rendered using separate GeoJSON source.

Avoids feature-state issues.

## Rendering Pipeline

1. Load visible site data for the current map state
2. Build or refresh the clustered GeoJSON source
3. Render circles and clusters with MapLibre
4. Render labels and cluster counts as HTML overlays
5. Render the selected site in a separate source

## Future Architecture

Potential upgrades:

vector tile serving
PMTiles
raster terrain
zoom-dependent geometry generalization
