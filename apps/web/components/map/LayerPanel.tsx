import { useEffect, useState } from "react";
import { fetchLayers, updateLayerVisibility } from "../../lib/api";
import type { LayerDefinition } from "../../lib/types";

interface LayerPanelProps {
  onLayerToggle?: (layerId: number, visible: boolean) => void;
}

export default function LayerPanel({ onLayerToggle }: LayerPanelProps) {
  const [layers, setLayers] = useState<LayerDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [layerVisibility, setLayerVisibility] = useState<Record<number, boolean>>({});

  useEffect(() => {
    async function loadLayers() {
      try {
        const fetchedLayers = await fetchLayers();
        setLayers(fetchedLayers);
        // Initialize visibility from default_visible
        const initialVisibility: Record<number, boolean> = {};
        fetchedLayers.forEach(layer => {
          initialVisibility[layer.id] = layer.default_visible;
        });
        setLayerVisibility(initialVisibility);
      } catch (error) {
        console.error("Failed to load layers:", error);
      } finally {
        setLoading(false);
      }
    }
    loadLayers();
  }, []);

  const visibleLayers = layers.filter((layer) => {
    // Only show layers that have real frontend behavior today.
    // Temporal filtering is handled by the PeriodFilter control, and the
    // other overlays below are still placeholders for future map work.
    if (
      ["chronology", "polity_regions", "population", "elevation"].includes(
        layer.key
      )
    ) {
      return false;
    }
    return true;
  });

  const handleToggle = (layerId: number, visible: boolean) => {
    setLayerVisibility(prev => ({ ...prev, [layerId]: visible }));
    updateLayerVisibility(layerId, visible);
    onLayerToggle?.(layerId, visible);
  };

  if (loading) {
    return (
      <div style={{ background: "white", padding: 12, borderRadius: 12, width: 220, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Layers</div>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ background: "white", padding: 12, borderRadius: 12, width: 220, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Layers</div>
      {visibleLayers.map(layer => (
        <label key={layer.id} style={{ display: "block", marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={layerVisibility[layer.id] || false}
            onChange={(e) => handleToggle(layer.id, e.target.checked)}
          />
          {layer.display_name}
        </label>
      ))}
    </div>
  );
}
