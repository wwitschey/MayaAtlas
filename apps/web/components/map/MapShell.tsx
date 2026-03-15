"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import SearchBox from "./SearchBox";
import LayerPanel from "./LayerPanel";
import SiteDrawer from "./SiteDrawer";
import PeriodFilter from "./PeriodFilter";
import type { SiteDetail, SiteSummary } from "../../lib/types";
import { getSite, listSites } from "../../lib/api";
import {
  getQueryTileZoom,
  getVisibleTiles,
  tileBboxString,
  tileKey,
  type TileCoord,
} from "../../lib/tiles";

const SOURCE_ID = "maya-sites";
const SELECTED_SOURCE_ID = "maya-selected-site";
const TERRAIN_SOURCE_ID = "maya-terrain-3d";
const HILLSHADE_SOURCE_ID = "maya-terrain-hillshade";
const HILLSHADE_LAYER_ID = "maya-hillshade";
const DEFAULT_TERRAIN_TILES_URL =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
const DEFAULT_TERRAIN_ENCODING = "terrarium";
const DEFAULT_TERRAIN_TILE_SIZE = 256;

const CLUSTER_LAYER_ID = "maya-sites-clusters";
const CIRCLE_LAYER_ID = "maya-sites-circles";
const SELECTED_LAYER_ID = "maya-selected-site-circle";
const REFRESH_DEBOUNCE_MS = 250;
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "Maya Atlas Base",
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#f5efe2",
      },
    },
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster",
      minzoom: 0,
      maxzoom: 19,
      paint: {
        "raster-opacity": 0.9,
        "raster-saturation": -0.15,
      },
    },
  ],
};

type ClusterSource = maplibregl.GeoJSONSource & {
  getClusterExpansionZoom?: (
    clusterId: number,
    callback: (err: unknown, zoom: number) => void
  ) => void;
};

type TileCacheValue = {
  sites: SiteSummary[];
  fetchedAt: number;
};

type LabelMarkerMap = Map<string, maplibregl.Marker>;
type ClusterMarkerMap = Map<string, maplibregl.Marker>;

function emptyGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return { type: "FeatureCollection", features: [] };
}

function toGeoJSON(
  sites: SiteSummary[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: sites.map((site) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [site.longitude, site.latitude],
      },
      properties: {
        slug: site.slug,
        display_name: site.display_name,
        site_type: site.site_type,
        country_code: site.country_code ?? "",
      },
    })),
  };
}

function selectedSiteGeoJSON(
  site: Pick<SiteSummary, "slug" | "display_name" | "longitude" | "latitude">
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [site.longitude, site.latitude],
        },
        properties: {
          slug: site.slug,
          display_name: site.display_name,
        },
      },
    ],
  };
}

function buildSiteFilter(
  selectedSlug: string | null
): maplibregl.FilterSpecification | undefined {
  if (!selectedSlug) return undefined;
  return ["!=", "slug", selectedSlug] as maplibregl.FilterSpecification;
}

function buildUnclusteredSiteFilter(
  selectedSlug: string | null
): maplibregl.FilterSpecification {
  if (!selectedSlug) {
    return ["!has", "point_count"] as maplibregl.FilterSpecification;
  }

  return [
    "all",
    ["!has", "point_count"],
    ["!=", "slug", selectedSlug],
  ] as maplibregl.FilterSpecification;
}

function addTerrainSource(map: maplibregl.Map) {
  const terrainTilesUrl =
    process.env.NEXT_PUBLIC_TERRAIN_TILES_URL || DEFAULT_TERRAIN_TILES_URL;
  if (!terrainTilesUrl) return;

  const tileSize = Number(
    process.env.NEXT_PUBLIC_TERRAIN_TILE_SIZE || String(DEFAULT_TERRAIN_TILE_SIZE)
  );
  const encoding =
    process.env.NEXT_PUBLIC_TERRAIN_ENCODING || DEFAULT_TERRAIN_ENCODING;

  if (!map.getSource(TERRAIN_SOURCE_ID)) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: "raster-dem",
      tiles: [terrainTilesUrl],
      tileSize,
      encoding,
    } as maplibregl.RasterDEMSourceSpecification);
  }

  if (!map.getSource(HILLSHADE_SOURCE_ID)) {
    map.addSource(HILLSHADE_SOURCE_ID, {
      type: "raster-dem",
      tiles: [terrainTilesUrl],
      tileSize,
      encoding,
    } as maplibregl.RasterDEMSourceSpecification);
  }
}

function syncElevationLayers(map: maplibregl.Map, enabled: boolean) {
  const hasTerrainSource = Boolean(map.getSource(TERRAIN_SOURCE_ID));
  const hasHillshadeSource = Boolean(map.getSource(HILLSHADE_SOURCE_ID));
  if (!hasTerrainSource || !hasHillshadeSource) return;

  if (!map.getLayer(HILLSHADE_LAYER_ID)) {
    map.addLayer({
      id: HILLSHADE_LAYER_ID,
      type: "hillshade",
      source: HILLSHADE_SOURCE_ID,
      layout: {
        visibility: enabled ? "visible" : "none",
      },
      paint: {
        "hillshade-shadow-color": "#5b4636",
        "hillshade-highlight-color": "#fff7ed",
        "hillshade-accent-color": "#8b7355",
        "hillshade-exaggeration": 0.3,
      },
    }, CLUSTER_LAYER_ID);
  } else {
    map.setLayoutProperty(
      HILLSHADE_LAYER_ID,
      "visibility",
      enabled ? "visible" : "none"
    );
  }

  if (enabled) {
    map.setTerrain({
      source: TERRAIN_SOURCE_ID,
      exaggeration: 1.08,
    });
    return;
  }

  map.setTerrain(null);
}

export default function MapShell() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSerialRef = useRef(0);
  const selectedPeriodRef = useRef<string>("");
  const tileCacheRef = useRef<Map<string, TileCacheValue>>(new Map());
  const labelMarkersRef = useRef<LabelMarkerMap>(new Map());
  const clusterMarkersRef = useRef<ClusterMarkerMap>(new Map());

  const [selectedSite, setSelectedSite] = useState<SiteDetail | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [elevationEnabled, setElevationEnabled] = useState(false);

  useEffect(() => {
    selectedPeriodRef.current = selectedPeriod;
  }, [selectedPeriod]);

  function clearPopup() {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }

  function clearLabelMarkers() {
    labelMarkersRef.current.forEach((marker) => marker.remove());
    labelMarkersRef.current.clear();
  }

  function clearClusterMarkers() {
    clusterMarkersRef.current.forEach((marker) => marker.remove());
    clusterMarkersRef.current.clear();
  }

  function formatClusterCount(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  }

  function syncClusterCountMarkers(map: maplibregl.Map) {
    const features = map.queryRenderedFeatures({
      layers: [CLUSTER_LAYER_ID],
    });
    const nextVisible = new Set<string>();

    for (const feature of features) {
      const pointCount = Number(feature.properties?.point_count ?? 0);
      if (!pointCount) continue;

      const geometry = feature.geometry;
      if (!geometry || geometry.type !== "Point") continue;

      const coordinates = geometry.coordinates as [number, number];
      const key = `${coordinates[0].toFixed(5)}:${coordinates[1].toFixed(5)}:${pointCount}`;
      nextVisible.add(key);

      if (!clusterMarkersRef.current.has(key)) {
        const label = document.createElement("div");
        label.textContent = formatClusterCount(pointCount);
        label.style.fontFamily =
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        label.style.fontSize = "12px";
        label.style.fontWeight = "700";
        label.style.lineHeight = "1";
        label.style.color = "#ffffff";
        label.style.pointerEvents = "none";

        const marker = new maplibregl.Marker({
          element: label,
          anchor: "center",
        })
          .setLngLat(coordinates)
          .addTo(map);

        clusterMarkersRef.current.set(key, marker);
      }
    }

    clusterMarkersRef.current.forEach((marker, key) => {
      if (!nextVisible.has(key)) {
        marker.remove();
        clusterMarkersRef.current.delete(key);
      }
    });
  }

  function syncLabelMarkers(map: maplibregl.Map, sites: SiteSummary[]) {
    const shouldShow = map.getZoom() >= 6.5;
    const nextVisible = new Set<string>();
    const occupiedCells = new Set<string>();
    const cellSize = map.getZoom() >= 9 ? 80 : 110;

    if (shouldShow) {
      for (const site of sites) {
        if (site.slug === selectedSlug) continue;

        const point = map.project([site.longitude, site.latitude]);
        const cellKey = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
        if (occupiedCells.has(cellKey)) continue;

        occupiedCells.add(cellKey);
        nextVisible.add(site.slug);

        if (!labelMarkersRef.current.has(site.slug)) {
          const label = document.createElement("div");
          label.textContent = site.display_name;
          label.style.fontFamily =
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          label.style.fontSize = "12px";
          label.style.fontWeight = "600";
          label.style.lineHeight = "1.1";
          label.style.color = "#1f2937";
          label.style.whiteSpace = "nowrap";
          label.style.textShadow =
            "0 0 2px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.95)";
          label.style.pointerEvents = "none";
          label.style.transform = "translateY(8px)";

          const marker = new maplibregl.Marker({
            element: label,
            anchor: "top",
          })
            .setLngLat([site.longitude, site.latitude])
            .addTo(map);

          labelMarkersRef.current.set(site.slug, marker);
        }
      }
    }

    labelMarkersRef.current.forEach((marker, slug) => {
      if (!nextVisible.has(slug)) {
        marker.remove();
        labelMarkersRef.current.delete(slug);
      }
    });
  }

  function clearSelectedOverlay() {
    const map = mapInstanceRef.current;
    if (!map) return;
    const source = map.getSource(SELECTED_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (source) source.setData(emptyGeoJSON());
    setSelectedSlug(null);
    const baseFilter = buildUnclusteredSiteFilter(null);
    if (map.getLayer(CIRCLE_LAYER_ID)) map.setFilter(CIRCLE_LAYER_ID, baseFilter);
    syncClusterCountMarkers(map);
  }

  function setSelectedOverlay(
    site: Pick<SiteSummary, "slug" | "display_name" | "longitude" | "latitude">
  ) {
    const map = mapInstanceRef.current;
    if (!map) return;
    const source = map.getSource(SELECTED_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (source) source.setData(selectedSiteGeoJSON(site));
    setSelectedSlug(site.slug);
    const filter = buildUnclusteredSiteFilter(site.slug);
    if (map.getLayer(CIRCLE_LAYER_ID))
      map.setFilter(CIRCLE_LAYER_ID, filter);
    const existingMarker = labelMarkersRef.current.get(site.slug);
    if (existingMarker) {
      existingMarker.remove();
      labelMarkersRef.current.delete(site.slug);
    }
  }

  function addMainSourceAndLayers(
    map: maplibregl.Map,
    selectedSlugOverride: string | null = selectedSlug,
    initialData: GeoJSON.FeatureCollection<GeoJSON.Point> = emptyGeoJSON()
  ) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: initialData,
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 8,
    });

    const siteFilter = buildUnclusteredSiteFilter(selectedSlugOverride);

    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"] as maplibregl.FilterSpecification,
      paint: {
        "circle-color": "#7c3aed",
        "circle-radius": [
          "step",
          ["get", "point_count"],
          16,
          10,
          20,
          50,
          26,
          100,
          32,
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-opacity": 0.9,
      },
    });

    const circleLayer: maplibregl.CircleLayerSpecification = {
      id: CIRCLE_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      filter: siteFilter,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          2.5,
          6,
          4.5,
          10,
          7,
        ],
        "circle-color": "#b91c1c",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.25,
        "circle-opacity": 0.9,
      },
    };
    map.addLayer(circleLayer);

  }

  async function fetchVisibleTiles(
    map: maplibregl.Map,
    period: string
  ): Promise<SiteSummary[]> {
    const bounds = map.getBounds();
    const queryZoom = getQueryTileZoom(map.getZoom());
    const tiles = getVisibleTiles(
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
      queryZoom
    );

    const requestId = ++requestSerialRef.current;

    const tileResults = await Promise.all(
      tiles.map(async (tile: TileCoord) => {
        const cacheKey = `${tileKey(tile)}|${period}`;
        const cached = tileCacheRef.current.get(cacheKey);
        if (cached) return cached.sites;

        const sites = await listSites(
          tileBboxString(tile),
          period || undefined,
          5000
        );

        tileCacheRef.current.set(cacheKey, {
          sites,
          fetchedAt: Date.now(),
        });

        return sites;
      })
    );

    if (requestId !== requestSerialRef.current) return [];

    const deduped = new Map<string, SiteSummary>();
    for (const group of tileResults) {
      for (const site of group) {
        if (!deduped.has(site.slug)) {
          deduped.set(site.slug, site);
        }
      }
    }

    return Array.from(deduped.values());
  }

  async function refreshMainSource(map: maplibregl.Map, period?: string) {
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const sites = await fetchVisibleTiles(map, period ?? "");
    source.setData(toGeoJSON(sites));
    syncLabelMarkers(map, sites);
    requestAnimationFrame(() => {
      syncClusterCountMarkers(map);
    });
  }

  function scheduleViewportRefresh(map: maplibregl.Map, period?: string) {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      void refreshMainSource(map, period);
    }, REFRESH_DEBOUNCE_MS);
  }

  function wireClusterInteractions(map: maplibregl.Map) {
    map.on("click", CLUSTER_LAYER_ID, (e) => {
      const feature = e.features?.[0];
      if (!feature) return;

      const clusterId = feature.properties?.cluster_id;
      const source = map.getSource(SOURCE_ID) as ClusterSource | undefined;
      if (!source?.getClusterExpansionZoom || clusterId == null) return;

      source.getClusterExpansionZoom(Number(clusterId), (err, zoom) => {
        if (err) return;

        const geometry = feature.geometry as GeoJSON.Point;
        const coordinates = geometry.coordinates as [number, number];

        map.easeTo({
          center: coordinates,
          zoom,
          duration: 500,
        });
      });
    });

    map.on("mouseenter", CLUSTER_LAYER_ID, () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", CLUSTER_LAYER_ID, () => {
      map.getCanvas().style.cursor = "";
    });
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: MAP_STYLE,
      center: [-89.5, 18.0],
      zoom: 5.5,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", async () => {
      addTerrainSource(map);
      const initialSites = await fetchVisibleTiles(map, selectedPeriodRef.current);
      addMainSourceAndLayers(map, null, toGeoJSON(initialSites));
      syncElevationLayers(map, elevationEnabled);
      wireClusterInteractions(map);

      map.addSource(SELECTED_SOURCE_ID, {
        type: "geojson",
        data: emptyGeoJSON(),
      });

      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: "circle",
        source: SELECTED_SOURCE_ID,
        paint: {
          "circle-radius": 18,
          "circle-color": "#2563eb",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      });

      map.on("click", CIRCLE_LAYER_ID, async (e) => {
        const feature = e.features?.[0];
        const slug = feature?.properties?.slug;
        const displayName = feature?.properties?.display_name;
        if (!slug) return;

        const geometry = feature.geometry as GeoJSON.Point;
        const coordinates = geometry.coordinates as [number, number];

        const selectedSummary: SiteSummary = {
          id: 0,
          slug,
          display_name: displayName ?? slug,
          canonical_name: displayName ?? slug,
          site_type: feature?.properties?.site_type ?? "settlement",
          country_code: feature?.properties?.country_code ?? "",
          short_description: null,
          longitude: coordinates[0],
          latitude: coordinates[1],
        };

        map.flyTo({
          center: coordinates,
          zoom: Math.max(map.getZoom(), 9),
          essential: true,
        });

        clearPopup();
        setSelectedOverlay(selectedSummary);

        popupRef.current = new maplibregl.Popup({ offset: 12 })
          .setLngLat(coordinates)
          .setHTML(`<strong>${displayName ?? slug}</strong>`)
          .addTo(map);

        const site = await getSite(slug);
        if (site) setSelectedSite(site);
      });

      map.on("mouseenter", CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("moveend", () => {
        scheduleViewportRefresh(map, selectedPeriodRef.current);
      });
    });

    mapInstanceRef.current = map;

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      clearPopup();
      clearLabelMarkers();
      clearClusterMarkers();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    clearPopup();
    clearSelectedOverlay();
    setSelectedSite(null);

    void refreshMainSource(map, selectedPeriod);
  }, [selectedPeriod]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncElevationLayers(map, elevationEnabled);
  }, [elevationEnabled]);

  async function handleSelectSite(site: SiteSummary) {
    const map = mapInstanceRef.current;
    if (map) {
      clearPopup();
      setSelectedOverlay(site);

      popupRef.current = new maplibregl.Popup({ offset: 12 })
        .setLngLat([site.longitude, site.latitude])
        .setHTML(`<strong>${site.display_name}</strong>`)
        .addTo(map);

      map.flyTo({
        center: [site.longitude, site.latitude],
        zoom: 9,
        essential: true,
      });
    }

    const detailedSite = await getSite(site.slug);
    if (detailedSite) {
      setSelectedSite(detailedSite);
    } else {
      setSelectedSite({
        ...site,
        sources: [],
      });
    }
  }

  function handleLayerToggle(layerId: number, visible: boolean) {
    const map = mapInstanceRef.current;
    if (!map) return;

    // For now, only handle sites layer (id 1)
    if (layerId === 1) {
      const layersToToggle = [CLUSTER_LAYER_ID, CIRCLE_LAYER_ID];
      layersToToggle.forEach((mapLayerId) => {
        if (map.getLayer(mapLayerId)) {
          map.setLayoutProperty(
            mapLayerId,
            "visibility",
            visible ? "visible" : "none"
          );
        }
      });
    }
    if (layerId === 2) {
      setElevationEnabled(visible);
    }
    // Other layers will be added later
  }

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          display: "grid",
          gap: 12,
        }}
      >
        <SearchBox onSelectSite={handleSelectSite} />
        <PeriodFilter value={selectedPeriod} onChange={setSelectedPeriod} />
        <LayerPanel onLayerToggle={handleLayerToggle} />
      </div>
      <SiteDrawer site={selectedSite} />
    </div>
  );
}
