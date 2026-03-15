from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ..db import SessionLocal
from sqlalchemy import text
import json

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/layers/{layer_id}/geojson")
def get_layer_geojson(layer_id: int, db: Session = Depends(get_db)):
    # Get layer info
    layer_query = text("SELECT key, layer_type FROM layers WHERE id = :layer_id")
    layer_result = db.execute(layer_query, {"layer_id": layer_id}).fetchone()
    if not layer_result:
        raise HTTPException(status_code=404, detail="Layer not found")

    layer_key, layer_type = layer_result

    if layer_type != "geojson":
        raise HTTPException(status_code=400, detail="Layer is not a GeoJSON layer")

    # For now, only sites layer has data
    if layer_key == "sites":
        # Get sites data
        sites_query = text("""
            SELECT id, slug, display_name, ST_X(centroid_geom) as longitude, ST_Y(centroid_geom) as latitude, site_type
            FROM sites
            LIMIT 100  -- For testing, limit to 100
        """)
        sites = db.execute(sites_query).fetchall()
        features = []
        for site in sites:
            features.append({
                "type": "Feature",
                "properties": {
                    "id": site[0],
                    "slug": site[1],
                    "display_name": site[2],
                    "site_type": site[5]
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [site[3], site[4]]
                }
            })

        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        return geojson
    else:
        # Placeholder for other layers
        return {"type": "FeatureCollection", "features": []}

# Placeholder for tile serving
@router.get("/layers/{layer_id}/tiles/{z}/{x}/{y}")
def get_layer_tile(layer_id: int, z: int, x: int, y: int):
    # For now, return 404 for non-sites layers
    raise HTTPException(status_code=404, detail="Tile not available")