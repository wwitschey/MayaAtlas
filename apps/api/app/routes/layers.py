from fastapi import APIRouter

router = APIRouter()

@router.get("/layers")
def get_layers():
    return [
        {"layer_key": "sites", "display_name": "Sites", "default_visible": True},
        {"layer_key": "elevation", "display_name": "Elevation", "default_visible": False},
        {"layer_key": "population", "display_name": "Population", "default_visible": False}
    ]
