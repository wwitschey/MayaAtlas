-- Population Estimates Table
-- Add table for historical population estimates

CREATE TABLE population_estimates (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  estimate_year INT,
  population INT NOT NULL,
  source_id BIGINT REFERENCES sources(id),
  certainty certainty_level NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_population_estimates_site_id ON population_estimates(site_id);