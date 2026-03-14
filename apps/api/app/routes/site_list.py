from fastapi import APIRouter, Query
from app.db import SessionLocal

router = APIRouter()


@router.get("/sites")
def list_sites(
    bbox: str | None = Query(default=None, description="west,south,east,north")
):
    if bbox:
        try:
            west, south, east, north = [float(x) for x in bbox.split(",")]
        except ValueError:
            return {"error": "Invalid bbox format. Use west,south,east,north"}

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
        WHERE ST_Intersects(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
          ST_MakeEnvelope(%s, %s, %s, %s, 4326)
        )
        ORDER BY display_name
        """
        params = (west, south, east, north)
    else:
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
        params = ()

    with SessionLocal() as session:
        rows = session.connection().exec_driver_sql(sql, params).mappings().all()
        return [dict(r) for r in rows]