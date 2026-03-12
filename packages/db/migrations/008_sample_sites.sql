INSERT INTO sources (short_citation, full_citation, title, publication_year)
VALUES ('Example 2020', 'Example Author. 2020. Example Maya Atlas Source.', 'Example Maya Atlas Source', 2020);

INSERT INTO sites (slug, canonical_name, display_name, short_description, site_type, country_code, admin_region, culture_area, centroid_geom, location_precision, is_major_site, public_status)
VALUES
  ('tikal', 'Tikal', 'Tikal', 'Major ancient Maya city in the Petén region.', 'city', 'GT', 'Petén', 'Maya Lowlands', ST_SetSRID(ST_MakePoint(-89.6237, 17.2216), 4326), 'exact', TRUE, 'published'),
  ('calakmul', 'Calakmul', 'Calakmul', 'Large Maya city in the central lowlands.', 'city', 'MX', 'Campeche', 'Maya Lowlands', ST_SetSRID(ST_MakePoint(-89.8915, 18.1047), 4326), 'exact', TRUE, 'published'),
  ('palenque', 'Palenque', 'Palenque', 'Classic Maya city known for architecture and inscriptions.', 'city', 'MX', 'Chiapas', 'Maya Lowlands', ST_SetSRID(ST_MakePoint(-92.0462, 17.4849), 4326), 'exact', TRUE, 'published'),
  ('chichen-itza', 'Chichén Itzá', 'Chichén Itzá', 'Major Postclassic Maya center in Yucatán.', 'city', 'MX', 'Yucatán', 'Northern Maya Lowlands', ST_SetSRID(ST_MakePoint(-88.5678, 20.6843), 4326), 'exact', TRUE, 'published'),
  ('copan', 'Copán', 'Copán', 'Important Maya city in western Honduras.', 'city', 'HN', 'Copán', 'Southeastern Maya Area', ST_SetSRID(ST_MakePoint(-89.1420, 14.8408), 4326), 'exact', TRUE, 'published');

INSERT INTO site_aliases (site_id, alias_name, alias_type)
SELECT id, 'Tikál', 'alternate_spelling' FROM sites WHERE slug = 'tikal';

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
VALUES
(
  'calakmul',
  'Calakmul',
  'Calakmul',
  'Major Maya city in the central lowlands of Campeche.',
  'city',
  'MX',
  'Campeche',
  'Maya Lowlands',
  ST_SetSRID(ST_MakePoint(-89.8915, 18.1047), 4326),
  'exact',
  TRUE,
  'published'
),
(
  'palenque',
  'Palenque',
  'Palenque',
  'Major Classic Maya city known for architecture and inscriptions.',
  'city',
  'MX',
  'Chiapas',
  'Maya Lowlands',
  ST_SetSRID(ST_MakePoint(-92.0462, 17.4849), 4326),
  'exact',
  TRUE,
  'published'
),
(
  'chichen-itza',
  'Chichén Itzá',
  'Chichén Itzá',
  'Major Maya site in northern Yucatán.',
  'city',
  'MX',
  'Yucatán',
  'Northern Maya Lowlands',
  ST_SetSRID(ST_MakePoint(-88.5678, 20.6843), 4326),
  'exact',
  TRUE,
  'published'
),
(
  'copan',
  'Copán',
  'Copán',
  'Major Maya city in western Honduras, famous for stelae and hieroglyphic stairway.',
  'city',
  'HN',
  'Copán',
  'Southeastern Maya Area',
  ST_SetSRID(ST_MakePoint(-89.1420, 14.8408), 4326),
  'exact',
  TRUE,
  'published'
)
ON CONFLICT (slug) DO NOTHING;