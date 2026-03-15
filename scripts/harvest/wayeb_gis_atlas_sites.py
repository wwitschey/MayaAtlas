#!/usr/bin/env python3

from __future__ import annotations

import csv
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import requests


OUTPUT_FILE = Path("data/raw/open-datasets/wayeb_sites.csv")
KML_URL = "https://www.wayeb.org/download/maps_maya-ruins.kml"
KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}
USER_AGENT = "MayaAtlas/0.1 (research prototype; local development)"
COUNTRY_CODE_MAP = {
    "belize": "BZ",
    "guatemala": "GT",
    "mexico": "MX",
    "honduras": "HN",
    "el salvador": "SV",
}


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[-\s]+", "-", value).strip("-")
    return value


def extract_country_code(description: str) -> str:
    lowered = description.lower()
    for country_name, country_code in COUNTRY_CODE_MAP.items():
        if country_name in lowered:
            return country_code
    return ""


def main() -> None:
    headers = {"User-Agent": USER_AGENT}
    response = requests.get(KML_URL, headers=headers, timeout=120)
    response.raise_for_status()

    # The published KML currently includes invalid UTF-8 bytes despite declaring UTF-8.
    sanitized_text = response.content.decode("latin-1").encode("utf-8", errors="replace")
    root = ET.fromstring(sanitized_text)
    placemarks = root.findall(".//kml:Placemark", KML_NS)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
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

    seen: set[tuple[int, int, str]] = set()
    count = 0
    with OUTPUT_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()

        for placemark in placemarks:
            name = (placemark.findtext("kml:name", default="", namespaces=KML_NS) or "").strip()
            coordinates = (
                placemark.findtext(
                    ".//kml:Point/kml:coordinates", default="", namespaces=KML_NS
                )
                or ""
            ).strip()
            description = (
                placemark.findtext("kml:description", default="", namespaces=KML_NS) or ""
            )

            if not name or not coordinates:
                continue

            lon_str, lat_str, *_ = [part.strip() for part in coordinates.split(",")]
            longitude = float(lon_str)
            latitude = float(lat_str)

            key = (round(longitude, 6), round(latitude, 6), name.lower())
            if key in seen:
                continue
            seen.add(key)

            writer.writerow(
                {
                    "canonical_name": name,
                    "display_name": name,
                    "slug": slugify(name),
                    "longitude": longitude,
                    "latitude": latitude,
                    "site_type": "archaeological_site",
                    "country_code": extract_country_code(description),
                    "short_description": "Maya archaeological site recorded in Wayeb GIS Atlas.",
                    "source": "Wayeb GIS Atlas",
                }
            )
            count += 1

    print(f"Extracted {count} Wayeb GIS Atlas sites to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
