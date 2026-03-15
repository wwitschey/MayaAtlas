#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

from ingest_open_datasets import (
    find_review_candidates,
    normalize_rows_with_report,
    read_rows,
    validate_rows,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_DIR = REPO_ROOT / "data" / "fixtures" / "open-datasets"
OSM_FIXTURE = FIXTURE_DIR / "osm_sites_fixture.csv"
WIKIDATA_FIXTURE = FIXTURE_DIR / "wikidata_sites_fixture.csv"


def main() -> None:
    osm_rows = read_rows(OSM_FIXTURE)
    wikidata_rows = read_rows(WIKIDATA_FIXTURE)

    validate_rows(osm_rows, OSM_FIXTURE.name)
    validate_rows(wikidata_rows, WIKIDATA_FIXTURE.name)

    normalization = normalize_rows_with_report(osm_rows, wikidata_rows)
    review_candidates = find_review_candidates(normalization.rows)
    slugs = {row.slug for row in normalization.rows}

    assert normalization.duplicate_slug_count == 0, normalization
    assert normalization.duplicate_coordinate_count == 2, normalization
    assert normalization.subfeature_filtered_count == 0, normalization
    assert len(normalization.rows) == 4, normalization

    assert "central-plaza" in slugs
    assert "takalik-abaj" in slugs
    assert "temple-5c-49" in slugs
    assert "tikal-temple-i" in slugs
    assert "central-plaza-marker" not in slugs
    assert len(review_candidates) == 1, review_candidates
    assert review_candidates[0]["left_slug"] == "temple-5c-49", review_candidates
    assert review_candidates[0]["right_slug"] == "tikal-temple-i", review_candidates
    assert review_candidates[0]["reason"] == "name_family_near_match", review_candidates

    print("Fixture ingestion verification passed")
    print(f"- rows: {len(normalization.rows)}")
    print(f"- duplicate_slug_count: {normalization.duplicate_slug_count}")
    print(f"- duplicate_coordinate_count: {normalization.duplicate_coordinate_count}")
    print(f"- subfeature_filtered_count: {normalization.subfeature_filtered_count}")
    print(f"- review_candidate_count: {len(review_candidates)}")


if __name__ == "__main__":
    main()
