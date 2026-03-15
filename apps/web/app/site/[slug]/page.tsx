import { getSite } from "../../../lib/api";
import type { SiteDetail } from "../../../lib/types";

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site: SiteDetail | null = await getSite(slug);

  if (!site) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Site not found</h1>
        <p>The site "{slug}" could not be found.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1>{site.display_name}</h1>
      <p><strong>Canonical Name:</strong> {site.canonical_name}</p>
      <p><strong>Type:</strong> {site.site_type}</p>
      {site.country_code && <p><strong>Country:</strong> {site.country_code}</p>}
      {site.short_description && <p><strong>Description:</strong> {site.short_description}</p>}
      <p><strong>Location:</strong> {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</p>
      {site.culture_area && <p><strong>Culture Area:</strong> {site.culture_area}</p>}
      {site.admin_region && <p><strong>Administrative Region:</strong> {site.admin_region}</p>}

      {site.aliases.length > 0 && (
        <section>
          <h2>Aliases</h2>
          <ul>
            {site.aliases.map((alias, i) => (
              <li key={i}>{alias}</li>
            ))}
          </ul>
        </section>
      )}

      {site.chronology.length > 0 && (
        <section>
          <h2>Chronology</h2>
          <ul>
            {site.chronology.map((chrono, i) => (
              <li key={i}>
                {chrono.period_label} ({chrono.start_year} - {chrono.end_year}) - {chrono.assertion_type} (certainty: {chrono.certainty})
              </li>
            ))}
          </ul>
        </section>
      )}

      {site.population_estimates.length > 0 && (
        <section>
          <h2>Population Estimates</h2>
          <ul>
            {site.population_estimates.map((est, i) => (
              <li key={i}>
                {est.estimate_year ? `${est.estimate_year}: ` : ""}{est.population} people (certainty: {est.certainty})
              </li>
            ))}
          </ul>
        </section>
      )}

      {site.sources.length > 0 && (
        <section>
          <h2>Sources</h2>
          <ul>
            {site.sources.map((source, i) => (
              <li key={i}>
                {source.short_citation}
                {source.title && ` - ${source.title}`}
                {source.url && <a href={source.url} target="_blank" rel="noopener"> (link)</a>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
