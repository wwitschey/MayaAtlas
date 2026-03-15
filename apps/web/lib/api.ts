import type { SiteDetail, SiteSummary, LayerDefinition } from "./types";
import { getApiBaseUrl } from "./env";

const API_BASE = getApiBaseUrl();

export async function searchSites(q: string): Promise<SiteSummary[]> {
  const response = await fetch(`${API_BASE}/api/search/sites?q=${encodeURIComponent(q)}`);
  if (!response.ok) return [];
  return response.json();
}

export async function listSites(
  bbox?: string,
  period?: string,
  limit = 5000
): Promise<SiteSummary[]> {
  const params = new URLSearchParams();

  if (bbox) params.set("bbox", bbox);
  if (period) params.set("period", period);
  params.set("limit", String(limit));

  const url = `${API_BASE}/api/sites?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

export async function getSite(slug: string): Promise<SiteDetail | null> {
  const response = await fetch(`${API_BASE}/api/sites/${encodeURIComponent(slug)}`);
  if (!response.ok) return null;
  return response.json();
}

export async function fetchLayers(): Promise<LayerDefinition[]> {
  const response = await fetch(`${API_BASE}/api/layers`);
  if (!response.ok) return [];
  return response.json();
}

export async function fetchLayerData(layerId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/api/layers/${layerId}/geojson`);
  if (!response.ok) return null;
  return response.json();
}

export async function updateLayerVisibility(layerId: number, visible: boolean): Promise<void> {
  // For now, just a placeholder - could be implemented as POST to update user prefs
  console.log(`Layer ${layerId} visibility: ${visible}`);
}
