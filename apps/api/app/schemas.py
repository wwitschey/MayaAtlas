from pydantic import BaseModel
from typing import Optional


class SourceInfo(BaseModel):
    short_citation: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None


class SiteSummary(BaseModel):
    id: int
    slug: str
    display_name: str
    canonical_name: str
    site_type: str
    country_code: Optional[str] = None
    short_description: Optional[str] = None
    longitude: float
    latitude: float


class SiteDetail(BaseModel):
    id: int
    slug: str
    display_name: str
    canonical_name: str
    site_type: str
    country_code: Optional[str] = None
    short_description: Optional[str] = None
    longitude: float
    latitude: float
    sources: list[SourceInfo] = []
    aliases: list[str] = []
    chronology: list[dict] = []
    population_estimates: list[dict] = []
    culture_area: Optional[str] = None
    admin_region: Optional[str] = None


class LayerDefinition(BaseModel):
    id: int
    key: str
    display_name: str
    description: Optional[str] = None
    layer_type: str
    default_visible: bool
    z_index: int


class DataSourceDefinition(BaseModel):
    id: int
    layer_id: int
    source_type: str
    source_url: Optional[str] = None
    source_query: Optional[str] = None
    display_order: int


class LayerStyleDefinition(BaseModel):
    id: int
    layer_id: int
    paint_properties: Optional[dict] = None
    layout_properties: Optional[dict] = None
    filter_expression: Optional[dict] = None