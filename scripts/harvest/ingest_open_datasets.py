#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import os
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "raw" / "open-datasets"
CURATED_DIR = REPO_ROOT / "data" / "curated" / "open-datasets"
WIKIDATA_RAW = RAW_DIR / "wikidata_sites.csv"
OSM_RAW = RAW_DIR / "osm_sites.csv"
CURATED_OUTPUT = CURATED_DIR / "sites_normalized.csv"
CANONICAL_SITE_HINTS = (
    "zona arqueológica",
    "zona arqueologica",
    "archaeological site",
    "sitio arqueológico",
    "sitio arqueologico",
    "parque arqueológico",
    "parque arqueologico",
    "ruins",
    "grutas",
)
SUBFEATURE_HINTS = (
    "acropolis",
    "acrópolis",
    "grupo ",
    "group ",
    "structure ",
    "estela ",
    "templo ",
    "temple ",
    "platform",
    "plataforma",
    "area ",
    "torre ",
    "casa ",
)

load_dotenv(REPO_ROOT / ".env")


@dataclass(frozen=True)
class HarvestRow:
    canonical_name: str
    display_name: str
    slug: str
    longitude: float
    latitude: float
    site_type: str
    country_code: str
    short_description: str
    source: str


@dataclass(frozen=True)
class NormalizationResult:
    rows: list[HarvestRow]
    duplicate_slug_count: int
    duplicate_coordinate_count: int
    subfeature_filtered_count: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the open dataset ingestion workflow."
    )
    parser.add_argument(
        "--skip-harvest",
        action="store_true",
        help="Reuse existing raw CSV exports instead of harvesting again.",
    )
    parser.add_argument(
        "--skip-import",
        action="store_true",
        help="Stop after producing the curated normalized CSV.",
    )
    return parser.parse_args()


def run_python_script(script_path: Path) -> None:
    subprocess.run(["python3", str(script_path)], cwd=REPO_ROOT, check=True)


def read_rows(csv_path: Path) -> list[HarvestRow]:
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        rows: list[HarvestRow] = []

        for raw in reader:
            rows.append(
                HarvestRow(
                    canonical_name=(raw.get("canonical_name") or "").strip(),
                    display_name=(raw.get("display_name") or "").strip(),
                    slug=(raw.get("slug") or "").strip(),
                    longitude=float(raw["longitude"]),
                    latitude=float(raw["latitude"]),
                    site_type=(raw.get("site_type") or "").strip(),
                    country_code=(raw.get("country_code") or "").strip(),
                    short_description=(raw.get("short_description") or "").strip(),
                    source=(raw.get("source") or "").strip(),
                )
            )

    return rows


def validate_rows(rows: Iterable[HarvestRow], source_name: str) -> None:
    for index, row in enumerate(rows, start=2):
        if not row.slug:
            raise ValueError(f"{source_name}:{index} has an empty slug")
        if not row.display_name:
            raise ValueError(f"{source_name}:{index} has an empty display_name")
        if not -180 <= row.longitude <= 180:
            raise ValueError(f"{source_name}:{index} has invalid longitude {row.longitude}")
        if not -90 <= row.latitude <= 90:
            raise ValueError(f"{source_name}:{index} has invalid latitude {row.latitude}")


def normalize_rows(*datasets: list[HarvestRow]) -> list[HarvestRow]:
    return normalize_rows_with_report(*datasets).rows


def normalize_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def looks_like_canonical_site(name: str) -> bool:
    lowered = normalize_text(name)
    return any(hint in lowered for hint in CANONICAL_SITE_HINTS)


def looks_like_subfeature(name: str) -> bool:
    lowered = normalize_text(name)
    return any(hint in lowered for hint in SUBFEATURE_HINTS)


def should_filter_subfeature(candidate: HarvestRow, accepted_rows: Iterable[HarvestRow]) -> bool:
    if candidate.source != "OpenStreetMap":
        return False
    if not looks_like_subfeature(candidate.display_name):
        return False

    for existing in accepted_rows:
        if existing.source == candidate.source and existing.slug == candidate.slug:
            continue

        if not looks_like_canonical_site(existing.display_name):
            continue

        if abs(existing.longitude - candidate.longitude) > 0.02:
            continue
        if abs(existing.latitude - candidate.latitude) > 0.02:
            continue

        return True

    return False


def is_near_existing_row(candidate: HarvestRow, accepted_rows: Iterable[HarvestRow]) -> bool:
    for existing in accepted_rows:
        if abs(existing.longitude - candidate.longitude) > 0.0005:
            continue
        if abs(existing.latitude - candidate.latitude) > 0.0005:
            continue
        return True
    return False


def normalize_rows_with_report(*datasets: list[HarvestRow]) -> NormalizationResult:
    # Prefer Wikidata rows when slugs collide; otherwise keep the first seen row.
    source_priority = {"Wikidata": 0, "OpenStreetMap": 1}
    deduped_by_slug: dict[str, HarvestRow] = {}
    seen_exact_coords: set[tuple[int, int]] = set()
    duplicate_slug_count = 0
    duplicate_coordinate_count = 0
    subfeature_filtered_count = 0

    for row in sorted(
        [row for dataset in datasets for row in dataset],
        key=lambda row: (source_priority.get(row.source, 99), row.slug, row.display_name),
    ):
        if should_filter_subfeature(row, deduped_by_slug.values()):
            subfeature_filtered_count += 1
            continue

        coord_key = (round(row.longitude * 1_000_000), round(row.latitude * 1_000_000))
        if coord_key in seen_exact_coords or is_near_existing_row(row, deduped_by_slug.values()):
            duplicate_coordinate_count += 1
            continue

        existing = deduped_by_slug.get(row.slug)
        if existing is None:
            deduped_by_slug[row.slug] = row
            seen_exact_coords.add(coord_key)
            continue

        duplicate_slug_count += 1
        existing_priority = source_priority.get(existing.source, 99)
        row_priority = source_priority.get(row.source, 99)
        if row_priority < existing_priority:
            deduped_by_slug[row.slug] = row

    rows = sorted(deduped_by_slug.values(), key=lambda row: row.display_name.lower())
    return NormalizationResult(
        rows=rows,
        duplicate_slug_count=duplicate_slug_count,
        duplicate_coordinate_count=duplicate_coordinate_count,
        subfeature_filtered_count=subfeature_filtered_count,
    )


def write_curated_csv(rows: list[HarvestRow], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
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

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "canonical_name": row.canonical_name,
                    "display_name": row.display_name,
                    "slug": row.slug,
                    "longitude": row.longitude,
                    "latitude": row.latitude,
                    "site_type": row.site_type,
                    "country_code": row.country_code,
                    "short_description": row.short_description,
                    "source": row.source,
                }
            )


def print_summary(
    raw_rows: list[HarvestRow],
    normalization: NormalizationResult,
) -> None:
    source_counts = Counter(row.source for row in raw_rows)

    print("Open dataset ingestion summary")
    print(f"- raw rows: {len(raw_rows)}")
    for source, count in sorted(source_counts.items()):
        print(f"- {source}: {count}")
    print(
        f"- duplicate slugs removed during normalization: {normalization.duplicate_slug_count}"
    )
    print(
        f"- duplicate coordinate pairs removed during normalization: "
        f"{normalization.duplicate_coordinate_count}"
    )
    print(
        f"- nearby OSM subfeatures filtered during normalization: "
        f"{normalization.subfeature_filtered_count}"
    )
    print(f"- curated rows written: {len(normalization.rows)}")
    print(f"- curated file: {CURATED_OUTPUT}")


def run_sql_import(normalized_file: Path) -> None:
    run_sql_import_with_report(normalized_file)


def run_sql_import_with_report(normalized_file: Path) -> dict[str, int]:
    database_url = os.getenv("PSQL_DATABASE_URL")
    if not database_url:
        sqlalchemy_url = os.getenv("DATABASE_URL")
        if sqlalchemy_url:
            database_url = sqlalchemy_url.replace("postgresql+psycopg://", "postgresql://", 1)
    if not database_url:
        raise RuntimeError(
            "PSQL_DATABASE_URL or DATABASE_URL is not set. Define one in .env or export it in your shell."
        )

    env = os.environ.copy()
    env["PSQL_DATABASE_URL"] = database_url

    completed = subprocess.run(
        ["bash", str(REPO_ROOT / "scripts" / "harvest" / "import_open_sites.sh"), str(normalized_file)],
        cwd=REPO_ROOT,
        check=True,
        env=env,
        capture_output=True,
        text=True,
    )

    metrics: dict[str, int] = {}
    for line in completed.stdout.splitlines():
        if "\t" not in line:
            continue
        metric, value = line.split("\t", 1)
        metric = metric.strip()
        value = value.strip()
        if not metric or not value.isdigit():
            continue
        metrics[metric] = int(value)

    return metrics


def print_import_report(metrics: dict[str, int]) -> None:
    if not metrics:
        print("- database import: complete")
        return

    print("- database import: complete")
    for metric in [
        "deduped_rows",
        "created_sites",
        "updated_sites",
        "unchanged_sites",
        "source_links_in_stage",
    ]:
        if metric in metrics:
            print(f"- {metric}: {metrics[metric]}")


def main() -> None:
    args = parse_args()

    if not args.skip_harvest:
        run_python_script(REPO_ROOT / "scripts" / "harvest" / "osm_archaeological_sites.py")
        run_python_script(REPO_ROOT / "scripts" / "harvest" / "wikidata_sites.py")

    osm_rows = read_rows(OSM_RAW)
    wikidata_rows = read_rows(WIKIDATA_RAW)

    validate_rows(osm_rows, OSM_RAW.name)
    validate_rows(wikidata_rows, WIKIDATA_RAW.name)

    raw_rows = [*osm_rows, *wikidata_rows]
    normalization = normalize_rows_with_report(osm_rows, wikidata_rows)
    write_curated_csv(normalization.rows, CURATED_OUTPUT)
    print_summary(raw_rows, normalization)

    if not args.skip_import:
        metrics = run_sql_import_with_report(CURATED_OUTPUT)
        print_import_report(metrics)


if __name__ == "__main__":
    main()
