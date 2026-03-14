"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import SearchBox from "./SearchBox";
import LayerPanel from "./LayerPanel";
import SiteDrawer from "./SiteDrawer";
import type { SiteDetail, SiteSummary } from "../../lib/types";
import { getSite, listSites } from "../../lib/api";

const SOURCE_ID = "maya-sites";
const CLUSTER_LAYER_ID = "maya-sites-clusters";
const CLUSTER_COUNT_LAYER_ID = "maya-sites-cluster-count";
const CIRCLE_LAYER_ID = "maya-sites-circles";
const LABEL_LAYER_ID = "maya-sites-labels";

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
      id: site.slug,
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

export default function MapShell() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const selectedFeatureIdRef = useRef<string | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [selectedSite, setSelectedSite] = useState<SiteDetail | null>(null);

  function clearPopup() {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }

  function setSelectedFeature(slug: string | null) {
    const map = mapInstanceRef.current;
    if (!map) return;

    const source = map.getSource(SOURCE_ID);
    if (!source) return;

    const previous = selectedFeatureIdRef.current;

    if (previous) {
      map.setFeatureState(
        { source: SOURCE_ID, id: previous },
        { selected: false }
      );
    }

    if (slug) {
      map.setFeatureState({ source: SOURCE_ID, id: slug }, { selected: true });
    }

    selectedFeatureIdRef.current = slug;
  }

  async function refreshSitesForViewport(map: maplibregl.Map) {
    const bounds = map.getBounds();
    if (!bounds) return;

    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ].join(",");

    const sites = await listSites(bbox);
    const data = toGeoJSON(sites);

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
    }
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
      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ].join(",");

      const sites = await listSites(bbox);
      const data = toGeoJSON(sites);

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data,
        promoteId: "slug",
        cluster: true,
        clusterMaxZoom: 8,
        clusterRadius: 50,
      });

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
          "circle-radius": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            9,
            6,
          ],
          "circle-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#2563eb",
            "#b91c1c",
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2.5,
            1.25,
          ],
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

      map.on("click", CIRCLE_LAYER_ID, async (e) => {
        const feature = e.features?.[0];
        const slug = feature?.properties?.slug;
        if (!slug) return;

        const geometry = feature.geometry as GeoJSON.Point;
        const coordinates = geometry.coordinates as [number, number];

        map.flyTo({
          center: coordinates,
          zoom: Math.max(map.getZoom(), 9),
          essential: true,
        });

        setSelectedFeature(slug);
        clearPopup();

        popupRef.current = new maplibregl.Popup({ offset: 12 })
          .setLngLat(coordinates)
          .setHTML(`<strong>${feature.properties?.display_name ?? slug}</strong>`)
          .addTo(map);

        const site = await getSite(slug);
        if (site) {
          setSelectedSite(site);
        }
      });

      map.on("mouseenter", CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("mouseenter", CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("moveend", async () => {
        await refreshSitesForViewport(map);
      });
    });

    mapInstanceRef.current = map;

    return () => {
      clearPopup();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  async function handleSelectSite(site: SiteSummary) {
    setSelectedFeature(site.slug);

    const map = mapInstanceRef.current;
    if (map) {
      clearPopup();

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
        <LayerPanel />
      </div>
      <SiteDrawer site={selectedSite} />
    </div>
  );
}