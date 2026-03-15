from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import SessionLocal
from ..schemas import LayerDefinition
from sqlalchemy import text

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/layers", response_model=list[LayerDefinition])
def get_layers(db: Session = Depends(get_db)):
    query = text("""
        SELECT id, key, display_name, description, layer_type, default_visible, z_index
        FROM layers
        ORDER BY z_index DESC
    """)
    result = db.execute(query)
    layers = result.fetchall()
    return [
        LayerDefinition(
            id=row[0],
            key=row[1],
            display_name=row[2],
            description=row[3],
            layer_type=row[4],
            default_visible=row[5],
            z_index=row[6]
        )
        for row in layers
    ]
