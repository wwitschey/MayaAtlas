INSERT INTO site_temporal_assertions (
  site_id,
  assertion_type,
  period_label,
  start_year,
  end_year,
  certainty
)
SELECT
  s.id,
  'florescence',
  v.period_label,
  v.start_year,
  v.end_year,
  'medium'
FROM sites s
JOIN (
  VALUES
    ('tikal', 'Late Classic', 600, 800),
    ('calakmul', 'Late Classic', 600, 800),
    ('palenque', 'Late Classic', 600, 800),
    ('copan', 'Late Classic', 600, 800),
    ('chichen-itza', 'Postclassic', 950, 1200),
    ('uxmal', 'Terminal Classic', 800, 950),
    ('caracol', 'Late Classic', 600, 800),
    ('yaxchilan', 'Late Classic', 600, 800),
    ('bonampak', 'Late Classic', 600, 800),
    ('piedras-negras', 'Late Classic', 600, 800),
    ('coba', 'Late Classic', 600, 800),
    ('quirigua', 'Late Classic', 600, 800),
    ('dzibilchaltun', 'Late Classic', 600, 800),
    ('edzna', 'Late Classic', 600, 800),
    ('lamanai', 'Postclassic', 950, 1521),
    ('tonina', 'Late Classic', 600, 800),
    ('el-mirador', 'Late Preclassic', -300, 250),
    ('nakbe', 'Late Preclassic', -300, 250),
    ('san-bartolo', 'Late Preclassic', -300, 250),
    ('ceibal', 'Late Classic', 600, 800)
) AS v(slug, period_label, start_year, end_year)
  ON s.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1
  FROM site_temporal_assertions sta
  WHERE sta.site_id = s.id
    AND sta.assertion_type = 'florescence'
);