DROP TABLE IF EXISTS witschey_brown_sites_stage;

CREATE TABLE witschey_brown_sites_stage (
  source_record_id TEXT,
  source_dataset TEXT,
  source_short_citation TEXT,
  source_url TEXT,
  license TEXT,
  raw_name TEXT,
  canonical_name TEXT,
  display_name TEXT,
  slug TEXT,
  rank_value INT,
  is_major_site BOOLEAN,
  site_type TEXT,
  country_code TEXT,
  admin_region TEXT,
  culture_area TEXT,
  longitude DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  location_precision TEXT,
  short_description TEXT,
  public_status TEXT
);