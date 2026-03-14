WITH deduped AS (
  SELECT DISTINCT ON (slug)
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
)
INSERT INTO sites (
  slug,
  canonical_name,
  display_name,
  short_description,
  site_type,
  country_code,
  admin_region,
  culture_area,
  centroid_geom,
  location_precision,
  is_major_site,
  public_status
)
SELECT
  d.slug,
  d.canonical_name,
  d.display_name,
  d.short_description,
  CASE
    WHEN d.site_type = 'city' THEN 'city'::site_type
    WHEN d.site_type = 'center' THEN 'center'::site_type
    WHEN d.site_type = 'ceremonial_center' THEN 'ceremonial_center'::site_type
    WHEN d.site_type = 'cave' THEN 'cave'::site_type
    WHEN d.site_type = 'port' THEN 'port'::site_type
    WHEN d.site_type = 'fortification' THEN 'fortification'::site_type
    ELSE 'settlement'::site_type
  END,
  NULLIF(d.country_code, ''),
  NULL,
  'Maya Region',
  ST_SetSRID(ST_MakePoint(d.longitude, d.latitude), 4326),
  'approximate'::location_precision,
  FALSE,
  'published'::public_status
FROM deduped d
ON CONFLICT (slug) DO UPDATE
SET
  canonical_name = EXCLUDED.canonical_name,
  display_name = EXCLUDED.display_name,
  short_description = EXCLUDED.short_description,
  site_type = EXCLUDED.site_type,
  country_code = EXCLUDED.country_code,
  centroid_geom = EXCLUDED.centroid_geom,
  updated_at = NOW();

INSERT INTO site_source_links (site_id, source_id, link_type, note)
SELECT DISTINCT
  si.id,
  so.id,
  'overview',
  'Imported from open dataset harvest pipeline'
FROM open_sites_stage st
JOIN sites si ON si.slug = st.slug
JOIN sources so ON so.short_citation = st.source
ON CONFLICT (site_id, source_id, link_type) DO NOTHING;