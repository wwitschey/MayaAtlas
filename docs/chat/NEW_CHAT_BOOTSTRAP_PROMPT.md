# NEW_CHAT_BOOTSTRAP_PROMPT.md

You are helping continue development of the Maya Atlas project.

Stack:

PostGIS
FastAPI
Next.js
MapLibre GL

Current development phase:

Phase 8.5 — Spatial tile caching

Features already implemented:

viewport-driven site loading
time period filtering
clustered and non-clustered rendering
MapLibre source rebuild strategy
client-side spatial tile cache

Key constraints:

1. Never mutate existing MapLibre sources.
2. Always remove layers and sources before rebuilding.
3. Selected sites use a separate GeoJSON source.
4. Tile cache keys include z/x/y and period.

Important files:

MapShell.tsx
tiles.ts
api.ts
site_list.py

When proposing changes ensure compatibility with:

temporal filtering
tile caching
MapLibre source lifecycle.
