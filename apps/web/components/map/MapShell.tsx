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
const TERRAIN_SOURCE_ID = "maya-terrain";

const CLUSTER_LAYER_ID = "maya-sites-clusters";
const CLUSTER_COUNT_LAYER_ID = "maya-sites-cluster-count";
const CIRCLE_LAYER_ID = "maya-sites-circles";
const LABEL_LAYER_ID = "maya-sites-labels";
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
  const terrainTilesUrl = process.env.NEXT_PUBLIC_TERRAIN_TILES_URL;
  if (!terrainTilesUrl || map.getSource(TERRAIN_SOURCE_ID)) return;

  const tileSize = Number(process.env.NEXT_PUBLIC_TERRAIN_TILE_SIZE || "256");
  const encoding =
    process.env.NEXT_PUBLIC_TERRAIN_ENCODING === "terrarium"
      ? "terrarium"
      : "mapbox";

  map.addSource(TERRAIN_SOURCE_ID, {
    type: "raster-dem",
    tiles: [terrainTilesUrl],
    tileSize,
    encoding,
  } as maplibregl.RasterDEMSourceSpecification);

  map.setTerrain({
    source: TERRAIN_SOURCE_ID,
    exaggeration: 1.1,
  });
}

export default function MapShell() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSerialRef = useRef(0);
  const selectedPeriodRef = useRef<string>("");
  const tileCacheRef = useRef<Map<string, TileCacheValue>>(new Map());

  const [selectedSite, setSelectedSite] = useState<SiteDetail | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    selectedPeriodRef.current = selectedPeriod;
  }, [selectedPeriod]);

  function clearPopup() {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
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
    if (map.getLayer(LABEL_LAYER_ID)) map.setFilter(LABEL_LAYER_ID, baseFilter);
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
    if (map.getLayer(LABEL_LAYER_ID))
      map.setFilter(LABEL_LAYER_ID, filter);
  }

  function addMainSourceAndLayers(
    map: maplibregl.Map,
    selectedSlugOverride: string | null = selectedSlug
  ) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: emptyGeoJSON(),
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

    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "point_count"] as maplibregl.FilterSpecification,
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
      },
      paint: {
        "text-color": "#ffffff",
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

    const labelLayer: maplibregl.SymbolLayerSpecification = {
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      filter: siteFilter,
      minzoom: 5.5,
      layout: {
        "text-field": ["get", "display_name"],
        "text-font": ["Open Sans Regular"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5.5,
          9,
          8,
          10,
          10,
          12,
        ],
        "text-offset": [0, 1.1],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.2,
      },
    };
    map.addLayer(labelLayer);
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

    map.on("load", () => {
      addTerrainSource(map);
      addMainSourceAndLayers(map, null);
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

      void refreshMainSource(map, selectedPeriodRef.current);

      map.on("moveend", () => {
        scheduleViewportRefresh(map, selectedPeriodRef.current);
      });
    });

    mapInstanceRef.current = map;

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      clearPopup();
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
      const layersToToggle = [
        CLUSTER_LAYER_ID,
        CLUSTER_COUNT_LAYER_ID,
        CIRCLE_LAYER_ID,
        LABEL_LAYER_ID,
      ];
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
