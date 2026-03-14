"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import SearchBox from "./SearchBox";
import LayerPanel from "./LayerPanel";
import SiteDrawer from "./SiteDrawer";
import type { SiteSummary } from "../../lib/types";
import { getSite, listSites } from "../../lib/api";

const SOURCE_ID = "maya-sites";
const CIRCLE_LAYER_ID = "maya-sites-circles";
const LABEL_LAYER_ID = "maya-sites-labels";

function toGeoJSON(sites: SiteSummary[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
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
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(null);

  function setSelectedFeature(slug: string | null) {
    const map = mapInstanceRef.current;
    console.log("[setSelectedFeature] called with slug:", slug);

    if (!map) {
      console.log("[setSelectedFeature] no map instance");
      return;
    }

    const source = map.getSource(SOURCE_ID);
    console.log("[setSelectedFeature] source exists:", !!source);

    if (!source) {
      console.log("[setSelectedFeature] source not ready");
      return;
    }

    const previous = selectedFeatureIdRef.current;
    console.log("[setSelectedFeature] previous selected slug:", previous);

    if (previous) {
      console.log("[setSelectedFeature] clearing previous feature state:", previous);
      map.setFeatureState({ source: SOURCE_ID, id: previous }, { selected: false });
    }

    if (slug) {
      console.log("[setSelectedFeature] setting selected feature state:", slug);
      map.setFeatureState({ source: SOURCE_ID, id: slug }, { selected: true });
    }

    selectedFeatureIdRef.current = slug;
    console.log("[setSelectedFeature] selectedFeatureIdRef now:", selectedFeatureIdRef.current);
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
      const sites = await listSites();
      const data = toGeoJSON(sites);

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data,
        promoteId: "slug",
      });

      map.addLayer({
        id: CIRCLE_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
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

      console.log("[map load] source added:", SOURCE_ID);
      console.log("[map load] circle layer added:", CIRCLE_LAYER_ID);
      console.log("[map load] label layer added:", LABEL_LAYER_ID);
      console.log("[map load] first few sites:", sites.slice(0, 5));

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

      map.on("click", CIRCLE_LAYER_ID, async (e) => {
        console.log("[marker click] event:", e);

        const feature = e.features?.[0];
        console.log("[marker click] feature:", feature);

        const slug = feature?.properties?.slug;
        console.log("[marker click] slug:", slug);

        if (!slug) {
          console.log("[marker click] no slug found");
          return;
        }

        const geometry = feature.geometry as GeoJSON.Point;
        const coordinates = geometry.coordinates as [number, number];
        console.log("[marker click] coordinates:", coordinates);

        map.flyTo({
          center: coordinates,
          zoom: Math.max(map.getZoom(), 9),
          essential: true,
        });

        setSelectedFeature(slug);

        console.log("[marker click] feature state after set:", map.getFeatureState({ source: SOURCE_ID, id: slug }));

        new maplibregl.Popup({ offset: 12 })
          .setLngLat(coordinates)
          .setHTML(`<strong>${feature.properties?.display_name ?? slug}</strong>`)
          .addTo(map);

        const site = await getSite(slug);
        console.log("[marker click] site API result:", site);

        if (site) {
          setSelectedSite(site);
        }
      });

      map.on("mouseenter", CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  function handleSelectSite(site: SiteSummary) {
    console.log("[handleSelectSite] site:", site);

    setSelectedSite(site);
    setSelectedFeature(site.slug);

    const map = mapInstanceRef.current;
    if (!map) {
      console.log("[handleSelectSite] no map instance");
      return;
    }

    map.flyTo({
      center: [site.longitude, site.latitude],
      zoom: 9,
      essential: true,
    });

    console.log(
      "[handleSelectSite] feature state after set:",
      map.getFeatureState({ source: SOURCE_ID, id: site.slug })
    );
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
