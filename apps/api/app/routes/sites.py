from fastapi import APIRouter, HTTPException
from app.db import SessionLocal

router = APIRouter()

@router.get("/sites/{slug}")
def get_site(slug: str):
    sql = """
    SELECT
      s.id,
      s.slug,
      s.display_name,
      s.canonical_name,
      s.short_description,
      ST_Y(s.centroid_geom) AS latitude,
      ST_X(s.centroid_geom) AS longitude,
      s.site_type::text AS site_type,
      s.country_code,
      s.culture_area,
      s.admin_region,
      COALESCE(
        json_agg(
          json_build_object(
            'short_citation', so.short_citation,
            'title', so.title,
            'url', so.url
          )
        ) FILTER (WHERE so.id IS NOT NULL),
        '[]'::json
      ) AS sources,
      COALESCE(
        json_agg(sa.alias_name) FILTER (WHERE sa.id IS NOT NULL),
        '[]'::json
      ) AS aliases,
      COALESCE(
        json_agg(
          json_build_object(
            'assertion_type', sta.assertion_type,
            'period_label', sta.period_label,
            'start_year', sta.start_year,
            'end_year', sta.end_year,
            'certainty', sta.certainty
          )
        ) FILTER (WHERE sta.id IS NOT NULL),
        '[]'::json
      ) AS chronology,
      COALESCE(
        json_agg(
          json_build_object(
            'estimate_year', pe.estimate_year,
            'population', pe.population,
            'certainty', pe.certainty
          )
        ) FILTER (WHERE pe.id IS NOT NULL),
        '[]'::json
      ) AS population_estimates
    FROM sites s
    LEFT JOIN site_source_links ssl
      ON ssl.site_id = s.id
    LEFT JOIN sources so
      ON so.id = ssl.source_id
    LEFT JOIN site_aliases sa
      ON sa.site_id = s.id
    LEFT JOIN site_temporal_assertions sta
      ON sta.site_id = s.id
    LEFT JOIN population_estimates pe
      ON pe.site_id = s.id
    WHERE s.slug = %s
    GROUP BY s.id
    """

    with SessionLocal() as session:
        row = session.connection().exec_driver_sql(sql, (slug,)).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Site not found")
        return dict(row)