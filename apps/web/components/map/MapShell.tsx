"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import SearchBox from "./SearchBox";
import LayerPanel from "./LayerPanel";
import SiteDrawer from "./SiteDrawer";
import type { SiteSummary } from "../../lib/types";

export default function MapShell() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json",
      center: [-89.5, 18.0],
      zoom: 5.5
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedSite || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({ center: [selectedSite.longitude, selectedSite.latitude], zoom: 9 });
  }, [selectedSite]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "grid", gap: 12 }}>
        <SearchBox onSelectSite={setSelectedSite} />
        <LayerPanel />
      </div>
      <SiteDrawer site={selectedSite} />
    </div>
  );
}
