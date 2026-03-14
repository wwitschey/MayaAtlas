#!/usr/bin/env python3

from __future__ import annotations

import csv
import re
import time
from pathlib import Path
from typing import Iterator

import requests


OUTPUT_FILE = Path("data/raw/open-datasets/wikidata_sites.csv")
SPARQL_URL = "https://query.wikidata.org/sparql"

# Maya-region rough bbox:
# west=-93, south=13, east=-86, north=23
# We constrain in-query so we do not ask Wikidata for the whole world.
BBOX_FILTER = """
  FILTER(?lon >= -93 && ?lon <= -86 && ?lat >= 13 && ?lat <= 23)
"""

USER_AGENT = "MayaAtlas/0.1 (research prototype; local development)"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[-\s]+", "-", value).strip("-")
    return value


def parse_point_wkt(point: str) -> tuple[float, float]:
    point = point.replace("Point(", "").replace(")", "").strip()
    lon_str, lat_str = point.split()
    return float(lon_str), float(lat_str)


def build_query(limit: int, offset: int) -> str:
    return f"""
    SELECT ?site ?siteLabel ?coord WHERE {{
      ?site wdt:P31/wdt:P279* wd:Q839954 .
      ?site wdt:P625 ?coord .
      BIND(geof:longitude(?coord) AS ?lon)
      BIND(geof:latitude(?coord) AS ?lat)
      {BBOX_FILTER}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    LIMIT {limit}
    OFFSET {offset}
    """


def fetch_batch(limit: int, offset: int) -> list[dict]:
    headers = {
        "Accept": "application/sparql-results+json",
        "User-Agent": USER_AGENT,
    }

    response = requests.get(
        SPARQL_URL,
        params={"query": build_query(limit, offset), "format": "json"},
        headers=headers,
        timeout=120,
    )

    if response.status_code == 429:
        retry_after = int(response.headers.get("Retry-After", "30"))
        print(f"429 from Wikidata; sleeping {retry_after}s")
        time.sleep(retry_after)
        response = requests.get(
            SPARQL_URL,
            params={"query": build_query(limit, offset), "format": "json"},
            headers=headers,
            timeout=120,
        )

    response.raise_for_status()
    payload = response.json()
    return payload.get("results", {}).get("bindings", [])


def iter_rows(batch_size: int = 500) -> Iterator[dict[str, str | float]]:
    offset = 0
    seen = set()

    while True:
        bindings = fetch_batch(batch_size, offset)
        if not bindings:
            break

        for item in bindings:
            name = item.get("siteLabel", {}).get("value", "").strip()
            coord = item.get("coord", {}).get("value", "").strip()
            if not name or not coord:
                continue

            try:
                lon, lat = parse_point_wkt(coord)
            except Exception:
                continue

            key = (round(lon, 6), round(lat, 6), name.lower())
            if key in seen:
                continue
            seen.add(key)

            yield {
                "canonical_name": name,
                "display_name": name,
                "slug": slugify(name),
                "longitude": lon,
                "latitude": lat,
                "site_type": "archaeological_site",
                "country_code": "",
                "short_description": "Archaeological site recorded in Wikidata.",
                "source": "Wikidata",
            }

        offset += batch_size
        time.sleep(1.5)  # polite pacing


def main() -> None:
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

    count = 0
    with OUTPUT_FILE.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for row in iter_rows():
            writer.writerow(row)
            count += 1

    print(f"Extracted {count} Wikidata archaeological sites to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()