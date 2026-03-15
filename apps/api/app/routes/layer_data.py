from fastapi import APIRouter, HTTPException, Depends, Response
from sqlalchemy.orm import Session
from ..db import SessionLocal
from sqlalchemy import text
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


def point_generalization_grid_size(z: int) -> float | None:
    """Return a Web Mercator grid size in meters for low-zoom point thinning."""
    if z <= 4:
        return 50000.0
    if z <= 6:
        return 20000.0
    if z <= 8:
        return 8000.0
    return None

@router.get("/layers/{layer_id}/geojson")
def get_layer_geojson(layer_id: int, period: str = None, db: Session = Depends(get_db)):
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
        query = """
            SELECT id, slug, display_name, ST_X(centroid_geom) as longitude, ST_Y(centroid_geom) as latitude, site_type
            FROM sites s
        """
        params = {}
        if period:
            query += """
            WHERE EXISTS (
              SELECT 1
              FROM site_temporal_assertions sta
              WHERE sta.site_id = s.id
                AND sta.period_label = :period
            )
            """
            params['period'] = period
        
        query += " LIMIT 1000"  # Increased limit
        
        sites = db.execute(text(query), params).fetchall()
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
def get_layer_tile(layer_id: int, z: int, x: int, y: int, period: str = None, db: Session = Depends(get_db)):
    # Get layer info
    layer_query = text("SELECT key, layer_type FROM layers WHERE id = :layer_id")
    layer_result = db.execute(layer_query, {"layer_id": layer_id}).fetchone()
    if not layer_result:
        raise HTTPException(status_code=404, detail="Layer not found")

    layer_key, layer_type = layer_result

    if layer_type != "vector_tiles":
        raise HTTPException(status_code=400, detail="Layer is not a vector tile layer")

    if layer_key == "sites":
        min_x, min_y, max_x, max_y = tile_bounds(z, x, y)
        grid_size = point_generalization_grid_size(z)

        params = {
            "min_x": min_x,
            "min_y": min_y,
            "max_x": max_x,
            "max_y": max_y,
            "grid_size": grid_size,
            "period": period,
        }

        query = """
            WITH bounds AS (
                SELECT
                    ST_MakeEnvelope(:min_x, :min_y, :max_x, :max_y, 3857) AS tile_bounds
            ),
            filtered_sites AS (
                SELECT
                    s.id,
                    s.slug,
                    s.display_name,
                    s.site_type,
                    COALESCE(s.country_code, '') AS country_code,
                    ST_Transform(s.centroid_geom, 3857) AS centroid_3857,
                    CASE
                        WHEN :grid_size IS NULL THEN NULL
                        ELSE FLOOR(ST_X(ST_Transform(s.centroid_geom, 3857)) / :grid_size)
                    END AS bucket_x,
                    CASE
                        WHEN :grid_size IS NULL THEN NULL
                        ELSE FLOOR(ST_Y(ST_Transform(s.centroid_geom, 3857)) / :grid_size)
                    END AS bucket_y
                FROM sites s
                CROSS JOIN bounds b
                WHERE ST_Intersects(ST_Transform(s.centroid_geom, 3857), b.tile_bounds)
                  AND (
                    CAST(:period AS text) IS NULL OR EXISTS (
                      SELECT 1
                      FROM site_temporal_assertions sta
                      WHERE sta.site_id = s.id
                        AND sta.period_label = CAST(:period AS text)
                    )
                  )
            ),
            cluster_features AS (
                SELECT
                    bucket_x,
                    bucket_y,
                    MIN(id) AS id,
                    NULL::text AS slug,
                    CONCAT(COUNT(*), ' sites') AS display_name,
                    'cluster'::text AS site_type,
                    ''::text AS country_code,
                    COUNT(*)::integer AS point_count,
                    CASE
                        WHEN COUNT(*) >= 1000 THEN CONCAT(ROUND(COUNT(*) / 1000.0, 1), 'k')
                        WHEN COUNT(*) >= 100 THEN CONCAT(ROUND(COUNT(*) / 100.0) * 100)
                        ELSE COUNT(*)::text
                    END AS point_count_abbreviated,
                    ST_Centroid(ST_Collect(centroid_3857)) AS geom_3857
                FROM filtered_sites
                WHERE :grid_size IS NOT NULL
                GROUP BY bucket_x, bucket_y
                HAVING COUNT(*) > 1
            ),
            singleton_features AS (
                SELECT
                    id,
                    slug,
                    display_name,
                    site_type::text AS site_type,
                    country_code,
                    NULL::integer AS point_count,
                    NULL::text AS point_count_abbreviated,
                    centroid_3857 AS geom_3857
                FROM filtered_sites
                WHERE :grid_size IS NULL
                UNION ALL
                SELECT
                    fs.id,
                    fs.slug,
                    fs.display_name,
                    fs.site_type::text AS site_type,
                    fs.country_code,
                    NULL::integer AS point_count,
                    NULL::text AS point_count_abbreviated,
                    fs.centroid_3857 AS geom_3857
                FROM filtered_sites fs
                WHERE :grid_size IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM cluster_features cf
                    WHERE cf.bucket_x = fs.bucket_x
                      AND cf.bucket_y = fs.bucket_y
                  )
            ),
            tile_features AS (
                SELECT
                    id,
                    slug,
                    display_name,
                    site_type,
                    country_code,
                    point_count,
                    point_count_abbreviated,
                    geom_3857
                FROM cluster_features
                UNION ALL
                SELECT
                    id,
                    slug,
                    display_name,
                    site_type,
                    country_code,
                    point_count,
                    point_count_abbreviated,
                    geom_3857
                FROM singleton_features
            ),
            mvtgeom AS (
                SELECT
                    id,
                    slug,
                    display_name,
                    site_type,
                    country_code,
                    point_count,
                    point_count_abbreviated,
                    ST_AsMVTGeom(
                        geom_3857,
                        (SELECT tile_bounds FROM bounds),
                        4096,
                        64,
                        true
                    ) AS geom
                FROM tile_features
            )
            SELECT COALESCE(
                ST_AsMVT(mvtgeom, 'sites', 4096, 'geom'),
                '\\x'::bytea
            ) AS tile
            FROM mvtgeom
        """

        tile = db.execute(text(query), params).scalar() or b""
        return Response(
            content=tile,
            media_type="application/vnd.mapbox-vector-tile",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    else:
        # Placeholder for other layers
        raise HTTPException(status_code=404, detail="Tile not available for this layer")
