"use client";

import { useState } from "react";
import type { SiteSummary } from "../../lib/types";
import { searchSites } from "../../lib/api";

export default function SearchBox({
  onSelectSite,
}: {
  onSelectSite: (site: SiteSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SiteSummary[]>([]);

  async function handleChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const found = await searchSites(value);
    setResults(found);
  }

  return (
    <div
      style={{
        background: "white",
        padding: 12,
        borderRadius: 12,
        width: 320,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}
    >
      <input
        value={query}
        onChange={(e) => void handleChange(e.target.value)}
        placeholder="Search Maya sites"
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
      />
      {results.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {results.map((site) => (
            <button
              key={site.slug}
              onClick={() => {
                onSelectSite(site);
                setQuery(site.display_name);
                setResults([]);
              }}
              style={{
                textAlign: "left",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #eee",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <div><strong>{site.display_name}</strong></div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {site.site_type} · {site.country_code ?? ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}