from fastapi import APIRouter
from app.db import SessionLocal

router = APIRouter()

@router.get("/sites")
def list_sites():
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
    ORDER BY display_name
    """
    with SessionLocal() as session:
        rows = session.connection().exec_driver_sql(sql).mappings().all()
        return [dict(r) for r in rows]