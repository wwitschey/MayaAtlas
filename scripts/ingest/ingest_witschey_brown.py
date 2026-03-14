#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import math
import re
from pathlib import Path
from typing import Any

SOURCE_DATASET = "witschey_brown_databasin"
SOURCE_SHORT_CITATION = "Witschey & Brown (Data Basin subset)"
SOURCE_URL = "https://databasin.org/datasets/3aa6b24c882144d6a4197bd277ae753d/"
LICENSE = "CC BY 3.0"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[-\s]+", "-", value).strip("-")
    return value


def truthy(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "t", "yes", "y"}


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_rank(row: dict[str, Any]) -> int | None:
    for key in ["rank", "Rank", "RANK", "site_rank", "SiteRank"]:
        if key in row and str(row[key]).strip():
            try:
                return int(float(str(row[key]).strip()))
            except ValueError:
                return None
    return None


def find_name(row: dict[str, Any]) -> str | None:
    for key in ["name", "Name", "NAME", "site_name", "SiteName", "ruinas", "label"]:
        if key in row and str(row[key]).strip():
            return str(row[key]).strip()
    return None


def find_lon_lat(row: dict[str, Any]) -> tuple[float | None, float | None]:
    lon_keys = ["longitude", "Longitude", "LONGITUDE", "lon", "x", "X"]
    lat_keys = ["latitude", "Latitude", "LATITUDE", "lat", "y", "Y"]

    lon = next((parse_float(row[k]) for k in lon_keys if k in row), None)
    lat = next((parse_float(row[k]) for k in lat_keys if k in row), None)

    if lon is not None and lat is not None:
        return lon, lat

    # Try geometry-like columns if present
    for gx in ["POINT_X", "point_x"]:
        for gy in ["POINT_Y", "point_y"]:
            if gx in row and gy in row:
                return parse_float(row[gx]), parse_float(row[gy])

    return None, None


def infer_country_code(name: str, lon: float | None, lat: float | None) -> str:
    # Minimal placeholder. Improve later with true spatial join.
    if lon is None or lat is None:
        return ""
    if lat < 15.3 and lon < -88.4:
        return "HN"
    if lat > 18.5 and lon > -90.5:
        return "MX"
    if -90.3 <= lon <= -88.0 and 15.0 <= lat <= 18.8:
        return "GT"
    if -89.4 <= lon <= -87.4 and 15.7 <= lat <= 18.6:
        return "BZ"
    return ""


def infer_site_type(rank_value: int | None) -> str:
    if rank_value in {1, 2}:
        return "city"
    return "settlement"


def make_description(name: str) -> str:
    return f"Maya archaeological site from the Witschey/Brown public subset."


def normalize_row(row: dict[str, Any], rownum: int) -> dict[str, Any] | None:
    raw_name = find_name(row)
    lon, lat = find_lon_lat(row)

    if not raw_name or lon is None or lat is None:
        return None

    rank_value = parse_rank(row)
    canonical_name = raw_name.strip()
    display_name = canonical_name
    slug = slugify(canonical_name)
    is_major_site = rank_value in {1, 2}
    site_type = infer_site_type(rank_value)
    country_code = infer_country_code(canonical_name, lon, lat)

    return {
        "source_record_id": row.get("id", row.get("ID", rownum)),
        "source_dataset": SOURCE_DATASET,
        "source_short_citation": SOURCE_SHORT_CITATION,
        "source_url": SOURCE_URL,
        "license": LICENSE,
        "raw_name": raw_name,
        "canonical_name": canonical_name,
        "display_name": display_name,
        "slug": slug,
        "rank_value": rank_value if rank_value is not None else "",
        "is_major_site": "true" if is_major_site else "false",
        "site_type": site_type,
        "country_code": country_code,
        "admin_region": "",
        "culture_area": "Maya Region",
        "longitude": lon,
        "latitude": lat,
        "location_precision": "approximate",
        "short_description": make_description(canonical_name),
        "public_status": "published",
    }


def ensure_unique_slugs(rows: list[dict[str, Any]]) -> None:
    seen: dict[str, int] = {}
    for row in rows:
        slug = row["slug"]
        if slug not in seen:
            seen[slug] = 1
            continue
        seen[slug] += 1
        row["slug"] = f"{slug}-{seen[slug]}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Raw CSV exported from Data Basin or equivalent")
    parser.add_argument("--output", required=True, help="Normalized CSV output path")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    normalized: list[dict[str, Any]] = []

    with input_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for rownum, row in enumerate(reader, start=1):
            clean = normalize_row(row, rownum)
            if clean:
                normalized.append(clean)

    ensure_unique_slugs(normalized)

    fieldnames = [
        "source_record_id",
        "source_dataset",
        "source_short_citation",
        "source_url",
        "license",
        "raw_name",
        "canonical_name",
        "display_name",
        "slug",
        "rank_value",
        "is_major_site",
        "site_type",
        "country_code",
        "admin_region",
        "culture_area",
        "longitude",
        "latitude",
        "location_precision",
        "short_description",
        "public_status",
    ]

    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(normalized)

    print(f"Wrote {len(normalized)} normalized rows to {output_path}")


if __name__ == "__main__":
    main()