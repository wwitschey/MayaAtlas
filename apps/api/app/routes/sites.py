from fastapi import APIRouter, HTTPException
from app.db import SessionLocal

router = APIRouter()

@router.get("/sites/{slug}")
def get_site(slug: str):
    sql = "SELECT * FROM site_summary_v WHERE slug = %s"
    with SessionLocal() as session:
        row = session.connection().exec_driver_sql(sql, (slug,)).mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Site not found")
        return dict(row)
