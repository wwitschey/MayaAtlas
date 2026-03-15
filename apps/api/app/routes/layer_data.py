from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ..db import SessionLocal
from sqlalchemy import text
import json
import mapbox_vector_tile

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def tile_bounds(z, x, y):
    """Calculate the bounding box for a tile in EPSG:3857"""
    # Tile size in pixels
    tile_size = 256
    # Earth's circumference at equator in meters
    earth_circumference = 40075016.68557849
    # Initial resolution at zoom 0
    initial_resolution = earth_circumference / tile_size

    # Resolution at this zoom level
    resolution = initial_resolution / (2 ** z)

    # Calculate bounds
    min_x = x * tile_size * resolution - earth_circumference / 2
    max_x = (x + 1) * tile_size * resolution - earth_circumference / 2
    min_y = earth_circumference / 2 - (y + 1) * tile_size * resolution
    max_y = earth_circumference / 2 - y * tile_size * resolution

    return min_x, min_y, max_x, max_y

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

@router.get("/layers/{layer_id}/tiles/{z}/{x}/{y}.pbf")
def get_layer_tile(layer_id: int, z: int, x: int, y: int, db: Session = Depends(get_db)):
    # Get layer info
    layer_query = text("SELECT key, layer_type FROM layers WHERE id = :layer_id")
    layer_result = db.execute(layer_query, {"layer_id": layer_id}).fetchone()
    if not layer_result:
        raise HTTPException(status_code=404, detail="Layer not found")

    layer_key, layer_type = layer_result

    if layer_type != "vector_tiles":
        raise HTTPException(status_code=400, detail="Layer is not a vector tile layer")

    if layer_key == "sites":
        # Calculate tile bounds
        min_x, min_y, max_x, max_y = tile_bounds(z, x, y)

        # Query sites within the tile bounds
        sites_query = text("""
            SELECT id, slug, display_name, ST_X(centroid_geom) as longitude, ST_Y(centroid_geom) as latitude, site_type
            FROM sites
            WHERE ST_Intersects(ST_Transform(centroid_geom, 3857), ST_MakeEnvelope(:min_x, :min_y, :max_x, :max_y, 3857))
        """)
        sites = db.execute(sites_query, {"min_x": min_x, "min_y": min_y, "max_x": max_x, "max_y": max_y}).fetchall()

        # Create GeoJSON features
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

        # Encode to vector tile
        if features:
            tile = mapbox_vector_tile.encode({
                "sites": features
            }, default_options={
                "name": "sites",
                "description": "Maya archaeological sites",
                "minzoom": 0,
                "maxzoom": 14
            })
            return tile
        else:
            # Empty tile
            return b""
    else:
        # Placeholder for other layers
        raise HTTPException(status_code=404, detail="Tile not available for this layer")