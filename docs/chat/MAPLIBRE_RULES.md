# MAPLIBRE_RULES.md

## Purpose

This document captures the MapLibre rules discovered during development of the Maya Atlas project.  
These rules prevent rendering errors, layer crashes, and state corruption when dynamically updating data.

The issues documented here were discovered while implementing:

- viewport-driven loading
- temporal filtering
- clustering
- spatial tile caching

These rules should be followed whenever modifying the map architecture.

---

# Core Rule

**Never mutate a MapLibre source that changes structural behavior.**

If any of the following change:

- clustering
- filtering
- source data structure
- tile loading strategy

then the source must be **destroyed and recreated**.

---

# Required Source Lifecycle

Whenever the site dataset refreshes:

1. Remove dependent layers
2. Remove the source
3. Recreate the source
4. Re-add layers
5. Reattach cluster click handlers

Pattern:

```
removeMainSourceAndLayers()
addMainSourceAndLayers()
wireClusterClick()
```

This avoids MapLibre internal errors.

---

# Known MapLibre Failure Modes

## Cluster + Filter Crash

MapLibre may throw errors like:

```
Cannot read properties of undefined (reading 'range')
```

Cause:

Clustered sources combined with dynamic filters.

Solution used in Maya Atlas:

```
clustered = !period
```

When a time period filter is active:

- clustering is disabled
- sites render as plain markers

---

# Selected Site Rendering

Using `feature-state` for selection caused instability when sources were rebuilt.

Solution:

Selected site uses a **separate GeoJSON source**.

```
maya-selected-site
```

Rendering layer:

```
maya-selected-site-circle
```

This allows the main site source to be safely rebuilt.

---

# Viewport Refresh Behavior

Map refresh is triggered by:

```
map.on("moveend")
```

Refresh is protected by:

- debounce timer
- viewport key comparison

Example viewport key:

```
west|south|east|north|period
```

Coordinates are rounded to reduce unnecessary reloads.

---

# Tile Cache Rules

Client-side spatial tile cache introduced in Phase 8.5.

Cache key:

```
z/x/y | period
```

Tile cache behavior:

- visible tiles are determined from map bounds
- each tile is fetched once
- results stored in memory
- tile results merged before rendering

This prevents repeated API calls when panning small distances.

---

# Cluster Handler Safety

Cluster click handlers must only be attached once.

Pattern used:

```
clusterHandlerAttachedRef
```

Otherwise multiple handlers accumulate after source rebuilds.

---

# Safe Rendering Pipeline

The correct pipeline for Maya Atlas is:

1. Determine visible tiles
2. Fetch tile data (using cache)
3. Merge tile results
4. Convert to GeoJSON
5. Remove layers
6. Remove source
7. Recreate source
8. Add layers
9. Reattach cluster click handler

---

# Future Improvements

Potential improvements that maintain compatibility with current rules:

- server-side tile caching
- vector tiles
- PMTiles
- terrain layers
- region polygon overlays

Any of these must preserve the **source rebuild pattern** above.

---

# Warning

Breaking these rules will likely produce:

- invisible markers
- cluster crashes
- stale site selections
- MapLibre runtime errors

Always test:

- clustering
- period filtering
- map panning
- map zooming
- marker click behavior

after any map architecture change.