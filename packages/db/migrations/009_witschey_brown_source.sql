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
  'Witschey & Brown (Data Basin subset)',
  'Witschey, Walter R.T.; Brown, Clifford T. Mayan Sites / Ruinas Maya. Public subset hosted on Data Basin, extracted from the Electronic Atlas of Ancient Maya Sites.',
  'Walter R.T. Witschey; Clifford T. Brown',
  'Mayan Sites / Ruinas Maya',
  2010,
  'https://databasin.org/datasets/3aa6b24c882144d6a4197bd277ae753d/',
  'CC BY 3.0',
  'Initial Maya Atlas site corpus source.'
WHERE NOT EXISTS (
  SELECT 1 FROM sources WHERE short_citation = 'Witschey & Brown (Data Basin subset)'
);