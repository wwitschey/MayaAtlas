CREATE VIEW site_summary_v AS
SELECT
  s.id,
  s.slug,
  s.display_name,
  s.canonical_name,
  s.site_type,
  s.country_code,
  s.short_description,
  ST_X(s.centroid_geom) AS longitude,
  ST_Y(s.centroid_geom) AS latitude
FROM sites s
WHERE s.public_status = 'published';
