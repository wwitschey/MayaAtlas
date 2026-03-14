import type { SiteDetail, SiteSummary } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function searchSites(q: string): Promise<SiteSummary[]> {
  const response = await fetch(`${API_BASE}/api/search/sites?q=${encodeURIComponent(q)}`);
  if (!response.ok) return [];
  return response.json();
}

export async function listSites(bbox?: string): Promise<SiteSummary[]> {
  const url = bbox
    ? `${API_BASE}/api/sites?bbox=${encodeURIComponent(bbox)}`
    : `${API_BASE}/api/sites`;

  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

export async function getSite(slug: string): Promise<SiteDetail | null> {
  const response = await fetch(`${API_BASE}/api/sites/${encodeURIComponent(slug)}`);
  if (!response.ok) return null;
  return response.json();
}