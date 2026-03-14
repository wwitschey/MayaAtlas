DROP TABLE IF EXISTS open_sites_stage;

CREATE TABLE open_sites_stage (
  slug TEXT,
  canonical_name TEXT,
  display_name TEXT,
  longitude DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  site_type TEXT,
  country_code TEXT,
  short_description TEXT,
  source TEXT
);