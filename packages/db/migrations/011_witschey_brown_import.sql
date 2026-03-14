TRUNCATE TABLE witschey_brown_sites_stage;

\copy witschey_brown_sites_stage (
  source_record_id,
  source_dataset,
  source_short_citation,
  source_url,
  license,
  raw_name,
  canonical_name,
  display_name,
  slug,
  rank_value,
  is_major_site,
  site_type,
  country_code,
  admin_region,
  culture_area,
  longitude,
  latitude,
  location_precision,
  short_description,
  public_status
)
FROM :'normalized_csv'
WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

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
  s.slug,
  s.canonical_name,
  s.display_name,
  s.short_description,
  CASE
    WHEN s.site_type = 'city' THEN 'city'::site_type
    WHEN s.site_type = 'settlement' THEN 'settlement'::site_type
    ELSE 'settlement'::site_type
  END,
  NULLIF(s.country_code, ''),
  NULLIF(s.admin_region, ''),
  NULLIF(s.culture_area, ''),
  ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326),
  CASE
    WHEN s.location_precision = 'exact' THEN 'exact'::location_precision
    WHEN s.location_precision = 'inferred' THEN 'inferred'::location_precision
    WHEN s.location_precision = 'generalized' THEN 'generalized'::location_precision
    ELSE 'approximate'::location_precision
  END,
  COALESCE(s.is_major_site, false),
  CASE
    WHEN s.public_status = 'draft' THEN 'draft'::public_status
    WHEN s.public_status = 'review' THEN 'review'::public_status
    WHEN s.public_status = 'hidden' THEN 'hidden'::public_status
    ELSE 'published'::public_status
  END
FROM witschey_brown_sites_stage s
ON CONFLICT (slug) DO UPDATE
SET
  canonical_name = EXCLUDED.canonical_name,
  display_name = EXCLUDED.display_name,
  short_description = EXCLUDED.short_description,
  site_type = EXCLUDED.site_type,
  country_code = EXCLUDED.country_code,
  admin_region = EXCLUDED.admin_region,
  culture_area = EXCLUDED.culture_area,
  centroid_geom = EXCLUDED.centroid_geom,
  location_precision = EXCLUDED.location_precision,
  is_major_site = EXCLUDED.is_major_site,
  public_status = EXCLUDED.public_status,
  updated_at = NOW();

INSERT INTO site_source_links (site_id, source_id, link_type, note)
SELECT
  si.id,
  so.id,
  'overview',
  'Imported from Witschey/Brown Data Basin subset'
FROM witschey_brown_sites_stage st
JOIN sites si ON si.slug = st.slug
JOIN sources so ON so.short_citation = st.source_short_citation
ON CONFLICT (site_id, source_id, link_type) DO NOTHING;