CREATE TABLE IF NOT EXISTS site_source_links (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, source_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_site_source_links_site_id
  ON site_source_links (site_id);

CREATE INDEX IF NOT EXISTS idx_site_source_links_source_id
  ON site_source_links (source_id);