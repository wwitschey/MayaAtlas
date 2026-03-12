import type { SiteSummary } from "../../lib/types";

export default function SiteDrawer({ site }: { site: SiteSummary | null }) {
  if (!site) return null;

  return (
    <aside
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        bottom: 16,
        width: 360,
        background: "white",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        overflow: "auto"
      }}
    >
      <h2 style={{ marginTop: 0 }}>{site.display_name}</h2>
      <p><strong>Type:</strong> {site.site_type}</p>
      <p><strong>Country:</strong> {site.country_code ?? "Unknown"}</p>
      <p><strong>Description:</strong> {site.short_description ?? "No summary yet."}</p>
      <p><strong>Coordinates:</strong> {site.latitude}, {site.longitude}</p>
    </aside>
  );
}
