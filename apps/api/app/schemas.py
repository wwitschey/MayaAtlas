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