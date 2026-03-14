from fastapi import APIRouter, Query
from app.db import SessionLocal

router = APIRouter()


@router.get("/sites")
def list_sites(
    bbox: str | None = Query(default=None, description="west,south,east,north"),
    period: str | None = Query(default=None, description="Broad historical period label"),
):
    where_clauses = []
    params: list[object] = []

    if bbox:
        try:
            west, south, east, north = [float(x) for x in bbox.split(",")]
        except ValueError:
            return {"error": "Invalid bbox format. Use west,south,east,north"}

        where_clauses.append(
            """
            ST_Intersects(
              ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
              ST_MakeEnvelope(%s, %s, %s, %s, 4326)
            )
            """
        )
        params.extend([west, south, east, north])

    if period:
        where_clauses.append(
            """
            EXISTS (
              SELECT 1
              FROM site_temporal_assertions sta
              WHERE sta.site_id = site_summary_v.id
                AND sta.period_label = %s
            )
            """
        )
        params.append(period)

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    sql = f"""
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
    {where_sql}
    ORDER BY display_name
    """

    with SessionLocal() as session:
        rows = session.connection().exec_driver_sql(sql, tuple(params)).mappings().all()
        return [dict(r) for r in rows]