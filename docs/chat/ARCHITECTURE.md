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

## Database

Primary tables:

sites
site_aliases
site_temporal_assertions
sources

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
maya-sites-cluster-count
maya-sites-circles
maya-sites-labels
maya-selected-site-circle

## Source Lifecycle

Each refresh performs:

removeMainSourceAndLayers()
addMainSourceAndLayers()
wireClusterClick()

Prevents MapLibre internal state errors.

## Temporal Filtering

Server-side filtering using period parameter.

Frontend request:

period=<label>

Clustering disabled when filtering.

## Tile System

Helper file:

apps/web/lib/tiles.ts

Key functions:

getVisibleTiles()
tileKey()
tileBboxString()
getQueryTileZoom()

Tile results cached client-side.

## Selection System

Selected site rendered using separate GeoJSON source.

Avoids feature-state issues.

## Rendering Pipeline

1. Determine visible tiles
2. Fetch tile data (cache aware)
3. Merge results
4. Convert to GeoJSON
5. Rebuild source
6. Render layers

## Future Architecture

Potential upgrades:

server-side tile caching
vector tile serving
PMTiles
improved spatial indexing
