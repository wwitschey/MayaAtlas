# MAPLIBRE_RULES.md

## Purpose

This document captures the MapLibre rules discovered during development of the Maya Atlas project.  
These rules prevent rendering errors, layer crashes, and state corruption when dynamically updating data.

The issues documented here were discovered while implementing:

- clustered site rendering
- selected-site overlays
- HTML label overlays
- MapLibre text/glyph failure recovery

These rules should be followed whenever modifying the map architecture.

---

# Core Rule

**Prefer the current stable map path unless there is a clear reason to change it.**

Current stable path:

- OpenStreetMap raster basemap
- clustered GeoJSON source for site points
- separate GeoJSON source for selected site
- HTML overlays for site labels and cluster count text
- optional hillshade and 3D terrain controls

If a MapLibre source must change structural behavior, destroy and recreate it.

Examples:

- clustering
- filtering
- source data structure
- source type

then the source must be **destroyed and recreated**.

---

# Required Source Lifecycle

When structural source behavior changes:

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

## Symbol Text Crash

MapLibre may throw errors like:

```
Cannot read properties of undefined (reading 'range')
```

Common trigger:

- symbol text layers
- glyph loading failures
- dynamic rebuilds around clustered sources

Stable solution used in Maya Atlas:

- do not use MapLibre symbol text for site names or cluster counts
- render text as HTML overlays instead

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

# HTML Overlay Rules

Use HTML overlays for:

- site labels
- cluster count text

Benefits:

- avoids glyph endpoint failures
- avoids symbol-layer rebuild crashes
- keeps label tuning separate from MapLibre source behavior

---

# Terrain Rules

Terrain should remain optional and lightweight.

Current approach:

- separate raster-dem source for hillshade
- separate raster-dem source for 3D terrain
- lazy-load terrain sources only when needed
- keep hillshade and 3D terrain as separate controls

3D terrain should not be the default visual mode at broad zoom levels.

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

1. Load site data for the current map state
2. Create or refresh the clustered GeoJSON source
3. Render circles and clusters with MapLibre
4. Render labels and cluster count text as HTML overlays
5. Reattach cluster click handler if the source was rebuilt

---

# Future Improvements

Potential improvements that maintain compatibility with current rules:

- vector tiles
- PMTiles
- terrain layers
- region polygon overlays

Any of these must preserve the stable rendering guarantees above.

---

# Warning

Breaking these rules will likely produce:

- invisible markers
- cluster crashes
- stale site selections
- MapLibre runtime errors

Always test:

- clustering
- map panning
- map zooming
- marker click behavior
- HTML label density
- cluster count overlays

after any map architecture change.
