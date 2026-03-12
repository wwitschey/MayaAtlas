CREATE INDEX idx_sites_centroid_geom ON sites USING GIST (centroid_geom);
CREATE INDEX idx_sites_slug ON sites (slug);
CREATE INDEX idx_sites_display_name_trgm ON sites USING GIN (display_name gin_trgm_ops);
CREATE INDEX idx_sites_canonical_name_trgm ON sites USING GIN (canonical_name gin_trgm_ops);
CREATE INDEX idx_site_aliases_alias_name_trgm ON site_aliases USING GIN (alias_name gin_trgm_ops);
