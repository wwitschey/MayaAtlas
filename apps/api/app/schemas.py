from pydantic import BaseModel
from typing import Optional

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
