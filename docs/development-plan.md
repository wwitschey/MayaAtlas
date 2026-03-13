
# Maya Atlas — Development Plan

## Project Vision
The Maya Atlas is a web-based interactive atlas of the Maya civilization designed to provide a Google-Maps-like experience for exploring Maya sites, geography, and historical information. Users will be able to zoom, search, filter by time period, and toggle thematic layers to better understand the spatial and temporal structure of Maya civilization.

The system is designed to support both public exploration and scholarly reference.

---

# Product Goals

## Core User Experience
Users should be able to:

- Explore the Maya region on an interactive map
- Search for archaeological sites
- Click sites to view metadata
- Zoom to reveal more spatial detail
- Toggle thematic layers such as elevation and population
- Filter the map by historical periods

## Geographic Scope (V1)
The atlas covers the broader Maya world including:

- Southern and southeastern Mexico
- Yucatán Peninsula
- Guatemala
- Belize
- Western Honduras
- Adjacent interaction zones where relevant

## Temporal Scope (V1)
Broad periods will be supported initially:

- Early / Middle Preclassic
- Late Preclassic
- Early Classic
- Late Classic
- Terminal Classic
- Postclassic

## V1 Non‑Goals
The first version will **not** include:

- User accounts or editing
- Continuous time animation
- 3D globe rendering
- Detailed excavation-level datasets
- Full scholarly debate modeling in UI
- Mobile-native applications

---

# System Architecture

## Technology Stack

Frontend
- Next.js
- TypeScript
- MapLibre GL JS

Backend API
- FastAPI

Database
- PostgreSQL
- PostGIS

Search
- PostgreSQL full‑text search + trigram indexes

Mapping Data
- GeoJSON for prototype
- Vector tiles / PMTiles for scaling

Hosting (future)
- Web frontend hosting
- API hosting
- Managed PostgreSQL
- Object storage / CDN for tiles

---

# Development Phases

## Phase 1 — Product Scope and Scholarly Model
Define project goals, scope, and how archaeological uncertainty will be represented.

Completed.

Key outputs:
- product scope
- scholarly modeling rules
- time period definitions
- uncertainty handling

---

## Phase 2 — Data Model and Schema
Define the relational schema and GIS model.

Completed.

Includes:
- site table
- alias table
- temporal assertions
- population estimates
- sources and citations
- regions
- layer definitions

SQL migrations created.

---

## Phase 3 — Implementation Architecture
Define repository structure and runtime architecture.

Completed.

Monorepo layout:

maya-atlas/
apps/
web/
api/
packages/
db/
data/
raw/
staging/
curated/
docs/
scripts/

---

## Phase 4 — Starter Scaffold
Build the first working vertical slice.

Completed.

Achievements:

- PostgreSQL/PostGIS installed
- Database created
- Schema migrations applied
- API server running
- Search endpoint functional
- Web app running
- Map shell implemented
- Search box connected to API
- Site drawer displaying metadata
- Baseline committed to Git

Current system status:

Working prototype pipeline

Web app → API → Database → results → UI

---

# Current Development Phase

## Phase 5 — Map Interactivity

Goal:
Make the map itself the primary navigation interface.

### Step 5.1 — Render site markers
Add Maya site points to the map.

Features:
- API endpoint returning site summaries
- MapLibre layer rendering points
- Labels appearing at higher zoom levels

### Step 5.2 — Marker click interaction
Allow users to click site markers.

Expected behavior:
- marker click opens site drawer
- metadata loaded by slug

### Step 5.3 — Search → map navigation
Search results should move the map.

Behavior:
- fly to selected site
- open metadata drawer

### Step 5.4 — Optional polish
Enhancements after markers work:

- marker highlight when selected
- popup on marker click
- smooth fly‑to behavior

---

# Phase 6 — Data Expansion

Goal:
Populate the atlas with meaningful real-world content.

Initial flagship sites:

- Tikal
- Calakmul
- Palenque
- Chichén Itzá
- Uxmal
- Copán
- Caracol
- Yaxchilán
- Bonampak
- Piedras Negras
- Coba
- Quiriguá
- Dzibilchaltún
- Edzná
- Lamanai
- Toniná
- El Mirador
- Nakbé
- San Bartolo
- Ceibal

Future expansions will add hundreds to thousands of sites.

---

# Phase 7 — Viewport-Based Loading

Goal:
Enable scalable map performance.

Implementation:

- `/api/sites?bbox=` endpoint
- map requests only sites inside the viewport
- reload sites on map movement

This enables handling thousands of sites.

---

# Phase 8 — Temporal Filtering

Goal:
Explore Maya civilization through time.

Implementation:

- period filter UI
- filter sites by temporal assertions
- broad historical periods only

Future version may include animated time slider.

---

# Phase 9 — Layer System

Goal:
Transform the atlas into a multi-layer GIS interface.

Layers planned:

- Maya sites
- elevation / hillshade
- population estimates
- chronology layer
- polity regions

Layer definitions will be stored in the database.

---

# Phase 10 — Site Detail Expansion

Goal:
Provide deeper scholarly information.

Site pages will include:

- aliases
- chronology
- population estimates
- citations
- media assets
- region relationships

Routes:
/site/[slug]

---

# Phase 11 — GIS Tile Architecture

Goal:
Scale mapping performance.

Implementation:

- vector tile pipeline
- PMTiles for static layers
- raster terrain tiles
- zoom-dependent geometry generalization

---

# Phase 12 — Data Ingestion Workflow

Goal:
Create sustainable data ingestion.

Pipeline stages:

1. raw data import
2. normalization
3. reconciliation
4. curated dataset
5. publishing scripts
6. tile generation

---

# Phase 13 — Deployment

Goal:
Production deployment.

Planned components:

- hosted web app
- API server
- managed PostgreSQL/PostGIS
- object storage for tiles
- CDN for map assets

---

# Current Project Status

Completed

- project scope
- scholarly model
- database schema
- architecture design
- starter scaffold
- PostgreSQL/PostGIS installation
- database migrations
- API working
- search endpoint working
- web app running
- site drawer functioning
- baseline Git commit

Next step

Phase 5 — Map interactivity.

Add site markers and enable marker click interaction.

---

# Git Branch Strategy

Suggested feature branches:

feature/map-site-markers
feature/flagship-site-data
feature/viewport-bbox-loading
feature/temporal-filtering
feature/layer-system
feature/site-detail-pages
feature/vector-tile-pipeline
feature/deployment

Each feature should be implemented in its own branch and merged after testing.

---

# Long-Term Vision

The Maya Atlas should eventually become:

- a scholarly spatial reference for Maya archaeology
- an educational exploration tool
- a platform capable of supporting large archaeological datasets
- a GIS-backed historical atlas of the Maya world
