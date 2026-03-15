-- Layer System Tables
-- Create tables for managing map layers, their data sources, and styling

CREATE TABLE layers (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,           -- 'sites', 'elevation', 'population', etc.
  display_name TEXT NOT NULL,
  description TEXT,
  layer_type TEXT NOT NULL CHECK (layer_type IN ('geojson', 'raster', 'vector_tiles')),
  default_visible BOOLEAN DEFAULT FALSE,
  z_index INT DEFAULT 0,              -- Layer stacking order
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE layer_data_sources (
  id BIGSERIAL PRIMARY KEY,
  layer_id BIGINT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('url', 'geojson', 'database')),
  source_url TEXT,                    -- For tiles/GeoJSON endpoints
  source_query TEXT,                  -- For database queries
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE layer_styles (
  id BIGSERIAL PRIMARY KEY,
  layer_id BIGINT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
  paint_properties JSONB,             -- MapLibre paint style
  layout_properties JSONB,            -- MapLibre layout style
  filter_expression JSONB,             -- MapLibre layer filter
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_layers_key ON layers(key);
CREATE INDEX idx_layer_data_sources_layer_id ON layer_data_sources(layer_id);
CREATE INDEX idx_layer_styles_layer_id ON layer_styles(layer_id);

-- Seed initial layers
INSERT INTO layers (key, display_name, description, layer_type, default_visible, z_index) VALUES
('sites', 'Maya Sites', 'Archaeological sites and settlements', 'geojson', true, 10),
('elevation', 'Elevation', 'Terrain elevation and hillshade', 'raster', false, 1),
('population', 'Population Estimates', 'Historical population density', 'raster', false, 2),
('chronology', 'Chronology', 'Temporal periods overlay', 'geojson', false, 5),
('polity_regions', 'Polity Regions', 'Political boundaries and regions', 'geojson', false, 3);