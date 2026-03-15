from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router as health_router
from app.routes.search import router as search_router
from app.routes.sites import router as sites_router
from app.routes.layers import router as layers_router
from app.routes.periods import router as periods_router
from app.routes.site_list import router as site_list_router
from app.routes.layer_data import router as layer_data_router

app = FastAPI(title="Maya Atlas API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(search_router, prefix="/api")
app.include_router(sites_router, prefix="/api")
app.include_router(site_list_router, prefix="/api")
app.include_router(layers_router, prefix="/api")
app.include_router(layer_data_router, prefix="/api")
app.include_router(periods_router, prefix="/api")