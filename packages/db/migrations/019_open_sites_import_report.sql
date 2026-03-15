DROP TABLE IF EXISTS open_sites_import_report;

CREATE TABLE open_sites_import_report (
  metric TEXT PRIMARY KEY,
  value BIGINT NOT NULL
);

WITH deduped AS (
  SELECT DISTINCT ON (s.slug)
    s.slug,
    s.canonical_name,
    s.display_name,
    s.short_description,
    s.site_type,
    s.country_code,
    s.longitude,
    s.latitude
  FROM open_sites_stage s
  WHERE s.slug IS NOT NULL
    AND s.slug <> ''
    AND s.longitude IS NOT NULL
    AND s.latitude IS NOT NULL
  ORDER BY
    s.slug,
    CASE
      WHEN s.source = 'Wikidata' THEN 1
      WHEN s.source = 'OpenStreetMap' THEN 2
      ELSE 99
    END,
    s.display_name
),
classified AS (
  SELECT
    d.*,
    si.id AS existing_site_id,
    CASE
      WHEN si.id IS NULL THEN 'created'
      WHEN si.canonical_name IS DISTINCT FROM d.canonical_name
        OR si.display_name IS DISTINCT FROM d.display_name
        OR si.short_description IS DISTINCT FROM d.short_description
        OR si.country_code IS DISTINCT FROM NULLIF(d.country_code, '')
        OR ST_X(si.centroid_geom) IS DISTINCT FROM d.longitude
        OR ST_Y(si.centroid_geom) IS DISTINCT FROM d.latitude
      THEN 'updated'
      ELSE 'unchanged'
    END AS import_action
  FROM deduped d
  LEFT JOIN sites si ON si.slug = d.slug
)
INSERT INTO open_sites_import_report (metric, value)
SELECT metric, value
FROM (
  SELECT 'deduped_rows'::text AS metric, COUNT(*)::bigint AS value
  FROM classified
  UNION ALL
  SELECT 'created_sites', COUNT(*)::bigint
  FROM classified
  WHERE import_action = 'created'
  UNION ALL
  SELECT 'updated_sites', COUNT(*)::bigint
  FROM classified
  WHERE import_action = 'updated'
  UNION ALL
  SELECT 'unchanged_sites', COUNT(*)::bigint
  FROM classified
  WHERE import_action = 'unchanged'
  UNION ALL
  SELECT 'source_links_in_stage', COUNT(DISTINCT (st.slug, st.source))::bigint
  FROM open_sites_stage st
  WHERE st.slug IS NOT NULL
    AND st.slug <> ''
) counts;
