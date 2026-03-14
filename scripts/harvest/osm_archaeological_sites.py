#!/usr/bin/env python3

from __future__ import annotations

import csv
import requests
import re
from pathlib import Path


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[-\s]+", "-", value).strip("-")
    return value


def main() -> None:
    bbox = "13,-93,23,-86"

    query = f"""
    [out:json][timeout:60];
    (
      node["historic"="archaeological_site"]({bbox});
      node["ruins"]({bbox});
      node["tourism"="ruins"]({bbox});
      way["historic"="archaeological_site"]({bbox});
      way["ruins"]({bbox});
      way["tourism"="ruins"]({bbox});
      relation["historic"="archaeological_site"]({bbox});
      relation["ruins"]({bbox});
      relation["tourism"="ruins"]({bbox});
    );
    out center;
    """

    url = "https://overpass-api.de/api/interpreter"
    response = requests.post(url, data=query, timeout=120)
    response.raise_for_status()
    data = response.json()

    out_path = Path("data/raw/open-datasets/osm_sites.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "canonical_name",
        "display_name",
        "slug",
        "longitude",
        "latitude",
        "site_type",
        "country_code",
        "short_description",
        "source",
    ]

    count = 0
    seen = set()

    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for el in data.get("elements", []):
            tags = el.get("tags", {})
            name = tags.get("name", "").strip()
            if not name:
                continue

            lon = el.get("lon")
            lat = el.get("lat")

            if lon is None or lat is None:
                center = el.get("center")
                if center:
                    lon = center.get("lon")
                    lat = center.get("lat")

            if lon is None or lat is None:
                continue

            key = (round(float(lon), 6), round(float(lat), 6), name.lower())
            if key in seen:
                continue
            seen.add(key)

            writer.writerow(
                {
                    "canonical_name": name,
                    "display_name": name,
                    "slug": slugify(name),
                    "longitude": lon,
                    "latitude": lat,
                    "site_type": "archaeological_site",
                    "country_code": "",
                    "short_description": "Archaeological site recorded in OpenStreetMap.",
                    "source": "OpenStreetMap",
                }
            )
            count += 1

    print(f"Extracted {count} OSM archaeological sites to {out_path}")


if __name__ == "__main__":
    main()