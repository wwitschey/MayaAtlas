ALTER TABLE sources ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS full_citation TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS authors TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS publication_year INT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS license TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS notes TEXT;

INSERT INTO sources (
  source_type,
  short_citation,
  full_citation,
  authors,
  title,
  publication_year,
  url,
  license,
  notes
)
SELECT
  'dataset',
  'OpenStreetMap',
  'OpenStreetMap archaeological site data harvested for Maya Atlas.',
  'OpenStreetMap contributors',
  'OpenStreetMap archaeological site extract',
  NULL,
  'https://www.openstreetmap.org',
  'ODbL',
  'Harvested from OpenStreetMap using Overpass.'
WHERE NOT EXISTS (
  SELECT 1 FROM sources WHERE short_citation = 'OpenStreetMap'
);

INSERT INTO sources (
  source_type,
  short_citation,
  full_citation,
  authors,
  title,
  publication_year,
  url,
  license,
  notes
)
SELECT
  'dataset',
  'Wikidata',
  'Wikidata archaeological site data harvested for Maya Atlas.',
  'Wikidata contributors',
  'Wikidata archaeological site extract',
  NULL,
  'https://www.wikidata.org',
  'CC0',
  'Harvested from Wikidata Query Service.'
WHERE NOT EXISTS (
  SELECT 1 FROM sources WHERE short_citation = 'Wikidata'
);