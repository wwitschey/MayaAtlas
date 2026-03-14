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
      COALESCE(
        json_agg(
          json_build_object(
            'short_citation', so.short_citation,
            'title', so.title,
            'url', so.url
          )
        ) FILTER (WHERE so.id IS NOT NULL),
        '[]'::json
      ) AS sources
    FROM sites s
    LEFT JOIN site_source_links ssl
      ON ssl.site_id = s.id
    LEFT JOIN sources so
      ON so.id = ssl.source_id
    WHERE s.slug = %s
    GROUP BY s.id
    """

    with SessionLocal() as session:
        row = session.connection().exec_driver_sql(sql, (slug,)).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Site not found")
        return dict(row)