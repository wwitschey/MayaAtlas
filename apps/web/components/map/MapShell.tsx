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

const SOURCE_ID = "maya-sites";
const SELECTED_SOURCE_ID = "maya-selected-site";

const CLUSTER_LAYER_ID = "maya-sites-clusters";
const CLUSTER_COUNT_LAYER_ID = "maya-sites-cluster-count";
const CIRCLE_LAYER_ID = "maya-sites-circles";
const LABEL_LAYER_ID = "maya-sites-labels";
const SELECTED_LAYER_ID = "maya-selected-site-circle";
const clusterHandlerAttachedRef = useRef(false);

const REFRESH_DEBOUNCE_MS = 250;

type ClusterSource = maplibregl.GeoJSONSource & {
  getClusterExpansionZoom?: (
    clusterId: number,
    callback: (err: unknown, zoom: number) => void
  ) => void;
};

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

function emptyGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return { type: "FeatureCollection", features: [] };
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

function roundCoord(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getRoundedBbox(map: maplibregl.Map): string {
  const bounds = map.getBounds();
  return [
    roundCoord(bounds.getWest()),
    roundCoord(bounds.getSouth()),
    roundCoord(bounds.getEast()),
    roundCoord(bounds.getNorth()),
  ].join(",");
}

export default function MapShell() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadedKeyRef = useRef<string | null>(null);
  const requestSerialRef = useRef(0);
  const selectedPeriodRef = useRef<string>("");

  const [selectedSite, setSelectedSite] = useState<SiteDetail | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

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
    const source = map.getSource(SELECTED_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(emptyGeoJSON());
  }

  function setSelectedOverlay(
    site: Pick<SiteSummary, "slug" | "display_name" | "longitude" | "latitude">
  ) {
    const map = mapInstanceRef.current;
    if (!map) return;
    const source = map.getSource(SELECTED_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(selectedSiteGeoJSON(site));
  }

  function removeMainSourceAndLayers(map: maplibregl.Map) {
    [LABEL_LAYER_ID, CIRCLE_LAYER_ID, CLUSTER_COUNT_LAYER_ID, CLUSTER_LAYER_ID].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  }

  function addMainSourceAndLayers(
    map: maplibregl.Map,
    data: GeoJSON.FeatureCollection<GeoJSON.Point>,
    clustered: boolean
  ) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data,
      ...(clustered
        ? {
            cluster: true,
            clusterMaxZoom: 8,
            clusterRadius: 50,
          }
        : {}),
    });

    if (clustered) {
      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
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
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      map.addLayer({
        id: CIRCLE_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 6,
          "circle-color": "#b91c1c",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.25,
        },
      });

      map.addLayer({
        id: LABEL_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        minzoom: 7,
        layout: {
          "text-field": ["get", "display_name"],
          "text-size": 12,
          "text-offset": [0, 1.2],
        },
        paint: {
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      });
    } else {
      map.addLayer({
        id: CIRCLE_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 6,
          "circle-color": "#b91c1c",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.25,
        },
      });

      map.addLayer({
        id: LABEL_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        minzoom: 7,
        layout: {
          "text-field": ["get", "display_name"],
          "text-size": 12,
          "text-offset": [0, 1.2],
        },
        paint: {
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      });
    }
  }

    function wireClusterClick(map: maplibregl.Map, clustered: boolean) {
      if (!clustered || clusterHandlerAttachedRef.current) return;

      clusterHandlerAttachedRef.current = true;

      map.on("click", CLUSTER_LAYER_ID, (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [CLUSTER_LAYER_ID],
      });

      const cluster = features[0];
      if (!cluster) return;

      const clusterId = cluster.properties?.cluster_id;
      const source = map.getSource(SOURCE_ID) as ClusterSource | undefined;

      if (!source?.getClusterExpansionZoom || clusterId == null) return;

      source.getClusterExpansionZoom(Number(clusterId), (err, zoom) => {
        if (err) return;

        const geometry = cluster.geometry as GeoJSON.Point;
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

  async function rebuildMainSourceForViewport(
    map: maplibregl.Map,
    options?: { force?: boolean; periodOverride?: string }
  ) {
    const bbox = getRoundedBbox(map);
    const period = options?.periodOverride ?? selectedPeriodRef.current;
    const key = `${bbox}|${period}`;
    const force = options?.force ?? false;

    if (!force && key === lastLoadedKeyRef.current) return;

    const requestId = ++requestSerialRef.current;
    const sites = await listSites(bbox, period || undefined);

    if (requestId !== requestSerialRef.current) return;

    const clustered = !period;
    const data = toGeoJSON(sites);

    clearPopup();
    clearSelectedOverlay();
    setSelectedSite(null);

    removeMainSourceAndLayers(map);
    addMainSourceAndLayers(map, data, clustered);
    lastLoadedKeyRef.current = key;
  }

  function scheduleViewportRefresh(
    map: maplibregl.Map,
    options?: { force?: boolean; periodOverride?: string }
  ) {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      void rebuildMainSourceForViewport(map, options);
    }, REFRESH_DEBOUNCE_MS);
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style:
        process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
        "https://demotiles.maplibre.org/style.json",
      center: [-89.5, 18.0],
      zoom: 5.5,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", async () => {
      const initialBbox = getRoundedBbox(map);
      const initialPeriod = selectedPeriodRef.current;
      const initialSites = await listSites(initialBbox, initialPeriod || undefined);
      const clustered = !initialPeriod;

      lastLoadedKeyRef.current = `${initialBbox}|${initialPeriod}`;

      addMainSourceAndLayers(map, toGeoJSON(initialSites), clustered);

      map.addSource(SELECTED_SOURCE_ID, {
        type: "geojson",
        data: emptyGeoJSON(),
      });

      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: "circle",
        source: SELECTED_SOURCE_ID,
        paint: {
          "circle-radius": 9,
          "circle-color": "#2563eb",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });

      wireClusterClick(map, clustered);

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
        scheduleViewportRefresh(map);
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

    scheduleViewportRefresh(map, {
      force: true,
      periodOverride: selectedPeriod,
    });
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
        <LayerPanel />
      </div>
      <SiteDrawer site={selectedSite} />
    </div>
  );
}