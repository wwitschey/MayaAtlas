#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import os
import re
import subprocess
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
import unicodedata
from typing import Iterable

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "raw" / "open-datasets"
CURATED_DIR = REPO_ROOT / "data" / "curated" / "open-datasets"
WIKIDATA_RAW = RAW_DIR / "wikidata_sites.csv"
OSM_RAW = RAW_DIR / "osm_sites.csv"
CURATED_OUTPUT = CURATED_DIR / "sites_normalized.csv"
REVIEW_OUTPUT = CURATED_DIR / "review_candidates.csv"
REVIEW_RESOLUTIONS = CURATED_DIR / "review_resolutions.csv"
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
GENERIC_NAME_TOKENS = {
    "archaeological",
    "archaeology",
    "archaeologico",
    "archaeological",
    "archaeological",
    "arqueologica",
    "arqueologico",
    "arqueologico",
    "arqueologica",
    "zona",
    "sitio",
    "site",
    "sites",
    "reserve",
    "reserva",
    "natural",
    "monument",
    "monumento",
    "parque",
    "park",
    "ruinas",
    "ruins",
    "ciudad",
    "prehispanica",
    "prehispanico",
    "maya",
    "de",
    "del",
    "la",
    "las",
    "el",
    "los",
    "the",
}

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
    review_candidate_count: int
    review_resolution_count: int


@dataclass(frozen=True)
class ReviewResolution:
    left_slug: str
    right_slug: str
    action: str
    keep_slug: str
    note: str


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


def resolution_pair_key(left_slug: str, right_slug: str) -> tuple[str, str]:
    return tuple(sorted((left_slug, right_slug)))


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


def normalize_ascii_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def tokenize_name(value: str) -> list[str]:
    ascii_text = normalize_ascii_text(normalize_text(value))
    cleaned = re.sub(r"[^a-z0-9]+", " ", ascii_text)
    return [token for token in cleaned.split() if token]


def significant_name_tokens(value: str) -> set[str]:
    return {
        token
        for token in tokenize_name(value)
        if len(token) >= 3 and token not in GENERIC_NAME_TOKENS
    }


def comparable_name(value: str) -> str:
    significant_tokens = sorted(significant_name_tokens(value))
    if significant_tokens:
        return " ".join(significant_tokens)
    return " ".join(tokenize_name(value))


def similarity_score(left: str, right: str) -> float:
    return SequenceMatcher(None, comparable_name(left), comparable_name(right)).ratio()


def has_shared_distinctive_tokens(left: str, right: str) -> bool:
    return bool(significant_name_tokens(left) & significant_name_tokens(right))


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
        review_candidate_count=0,
        review_resolution_count=0,
    )


def load_review_resolutions(
    csv_path: Path,
) -> dict[tuple[str, str], ReviewResolution]:
    if not csv_path.exists():
        return {}

    resolutions: dict[tuple[str, str], ReviewResolution] = {}
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for index, raw in enumerate(reader, start=2):
            left_slug = (raw.get("left_slug") or "").strip()
            right_slug = (raw.get("right_slug") or "").strip()
            action = (raw.get("action") or "").strip()
            keep_slug = (raw.get("keep_slug") or "").strip()
            note = (raw.get("note") or "").strip()

            if not left_slug or not right_slug:
                raise ValueError(f"{csv_path.name}:{index} must include left_slug and right_slug")
            if left_slug == right_slug:
                raise ValueError(f"{csv_path.name}:{index} cannot reference the same slug twice")
            if action not in {"keep_separate", "merge", "drop_osm_subfeature"}:
                raise ValueError(
                    f"{csv_path.name}:{index} has unsupported action {action!r}"
                )
            if action == "merge" and keep_slug not in {left_slug, right_slug}:
                raise ValueError(
                    f"{csv_path.name}:{index} merge action requires keep_slug to match one pair slug"
                )
            if action != "merge" and keep_slug:
                raise ValueError(
                    f"{csv_path.name}:{index} only merge actions may define keep_slug"
                )

            pair_key = resolution_pair_key(left_slug, right_slug)
            if pair_key in resolutions:
                raise ValueError(
                    f"{csv_path.name}:{index} duplicates an existing resolution pair"
                )

            resolutions[pair_key] = ReviewResolution(
                left_slug=left_slug,
                right_slug=right_slug,
                action=action,
                keep_slug=keep_slug,
                note=note,
            )

    return resolutions


def apply_review_resolutions(
    rows: list[HarvestRow],
    resolutions: dict[tuple[str, str], ReviewResolution],
) -> tuple[list[HarvestRow], int]:
    if not resolutions:
        return rows, 0

    rows_by_slug = {row.slug: row for row in rows}
    dropped_slugs: set[str] = set()

    for resolution in resolutions.values():
        left = rows_by_slug.get(resolution.left_slug)
        right = rows_by_slug.get(resolution.right_slug)
        if left is None or right is None:
            missing = resolution.left_slug if left is None else resolution.right_slug
            raise ValueError(
                f"review resolution references missing normalized slug {missing!r}"
            )

        if resolution.action == "keep_separate":
            continue

        if resolution.action == "merge":
            drop_slug = (
                resolution.right_slug
                if resolution.keep_slug == resolution.left_slug
                else resolution.left_slug
            )
            dropped_slugs.add(drop_slug)
            continue

        osm_rows = [row for row in (left, right) if row.source == "OpenStreetMap"]
        if len(osm_rows) != 1:
            raise ValueError(
                "drop_osm_subfeature resolution requires exactly one OpenStreetMap row"
            )
        dropped_slugs.add(osm_rows[0].slug)

    resolved_rows = [row for row in rows if row.slug not in dropped_slugs]
    return resolved_rows, len(resolutions)


def find_review_candidates(
    rows: list[HarvestRow],
    ignored_pairs: set[tuple[str, str]] | None = None,
) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    ignored_pairs = ignored_pairs or set()

    for index, left in enumerate(rows):
        for right in rows[index + 1 :]:
            pair_key = resolution_pair_key(left.slug, right.slug)
            if pair_key in ignored_pairs:
                continue
            if left.source == right.source:
                continue
            if left.slug == right.slug:
                continue

            lon_diff = abs(left.longitude - right.longitude)
            lat_diff = abs(left.latitude - right.latitude)
            if lon_diff > 0.02 or lat_diff > 0.02:
                continue

            score = similarity_score(left.display_name, right.display_name)
            left_name = comparable_name(left.display_name)
            right_name = comparable_name(right.display_name)
            same_name_family = (
                left_name in right_name or right_name in left_name
            )
            shared_tokens = has_shared_distinctive_tokens(
                left.display_name, right.display_name
            )
            if not shared_tokens:
                continue
            if score < 0.78 and not same_name_family:
                continue

            reason = "high_similarity_near_match"
            if same_name_family and score < 0.78:
                reason = "name_family_near_match"

            candidates.append(
                {
                    "left_slug": left.slug,
                    "left_name": left.display_name,
                    "left_source": left.source,
                    "left_longitude": str(left.longitude),
                    "left_latitude": str(left.latitude),
                    "right_slug": right.slug,
                    "right_name": right.display_name,
                    "right_source": right.source,
                    "right_longitude": str(right.longitude),
                    "right_latitude": str(right.latitude),
                    "name_similarity": f"{score:.3f}",
                    "longitude_delta": f"{lon_diff:.6f}",
                    "latitude_delta": f"{lat_diff:.6f}",
                    "reason": reason,
                }
            )

    return candidates


def write_review_candidates(candidates: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "left_slug",
        "left_name",
        "left_source",
        "left_longitude",
        "left_latitude",
        "right_slug",
        "right_name",
        "right_source",
        "right_longitude",
        "right_latitude",
        "name_similarity",
        "longitude_delta",
        "latitude_delta",
        "reason",
    ]

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for candidate in candidates:
            writer.writerow(candidate)


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
    print(f"- review resolutions applied: {normalization.review_resolution_count}")
    print(f"- review resolution file: {REVIEW_RESOLUTIONS}")
    print(f"- curated rows written: {len(normalization.rows)}")
    print(f"- curated file: {CURATED_OUTPUT}")
    print(f"- review candidates written: {normalization.review_candidate_count}")
    print(f"- review candidate file: {REVIEW_OUTPUT}")


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
    review_resolutions = load_review_resolutions(REVIEW_RESOLUTIONS)
    resolved_rows, resolution_count = apply_review_resolutions(
        normalization.rows, review_resolutions
    )
    review_candidates = find_review_candidates(
        resolved_rows,
        ignored_pairs=set(review_resolutions.keys()),
    )
    normalization = NormalizationResult(
        rows=resolved_rows,
        duplicate_slug_count=normalization.duplicate_slug_count,
        duplicate_coordinate_count=normalization.duplicate_coordinate_count,
        subfeature_filtered_count=normalization.subfeature_filtered_count,
        review_candidate_count=len(review_candidates),
        review_resolution_count=resolution_count,
    )
    write_curated_csv(normalization.rows, CURATED_OUTPUT)
    write_review_candidates(review_candidates, REVIEW_OUTPUT)
    print_summary(raw_rows, normalization)

    if not args.skip_import:
        metrics = run_sql_import_with_report(CURATED_OUTPUT)
        print_import_report(metrics)


if __name__ == "__main__":
    main()
