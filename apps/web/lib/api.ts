import type { SiteSummary } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function searchSites(q: string): Promise<SiteSummary[]> {
  const response = await fetch(`${API_BASE}/api/search/sites?q=${encodeURIComponent(q)}`);
  if (!response.ok) return [];
  return response.json();
}
