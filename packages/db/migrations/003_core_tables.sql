CREATE TABLE sources (
  id BIGSERIAL PRIMARY KEY,
  short_citation TEXT NOT NULL,
  full_citation TEXT,
  title TEXT,
  publication_year INT
);

CREATE TABLE sites (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  short_description TEXT,
  site_type site_type NOT NULL DEFAULT 'unknown',
  country_code TEXT,
  admin_region TEXT,
  culture_area TEXT,
  centroid_geom geometry(Point, 4326) NOT NULL,
  location_precision location_precision NOT NULL DEFAULT 'approximate',
  is_major_site BOOLEAN NOT NULL DEFAULT FALSE,
  public_status public_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE site_aliases (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  alias_type alias_type NOT NULL DEFAULT 'other'
);

CREATE TABLE site_temporal_assertions (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  assertion_type temporal_assertion_type NOT NULL,
  period_label TEXT,
  start_year INT,
  end_year INT,
  certainty certainty_level NOT NULL DEFAULT 'medium'
);
