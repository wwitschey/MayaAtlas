from fastapi import APIRouter, Query
from app.db import SessionLocal

router = APIRouter()

@router.get("/search/sites")
def search_sites(q: str = Query(..., min_length=1)):
    sql = """
    SELECT
      id,
      slug,
      display_name,
      canonical_name,
      site_type::text AS site_type,
      country_code,
      short_description,
      longitude,
      latitude
    FROM site_summary_v
    WHERE lower(display_name) LIKE lower(%s)
       OR lower(canonical_name) LIKE lower(%s)
    ORDER BY display_name
    LIMIT 10
    """
    like_value = f"%{q}%"
    with SessionLocal() as session:
        rows = session.connection().exec_driver_sql(sql, (like_value, like_value)).mappings().all()
        return [dict(r) for r in rows]
