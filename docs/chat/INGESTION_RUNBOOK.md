# INGESTION_RUNBOOK.md

## Purpose

This runbook explains how to operate the Phase 12 open-dataset ingestion workflow.

Primary scripts:

- `scripts/harvest/ingest_open_datasets.py`
- `scripts/harvest/import_open_sites.sh`
- `scripts/harvest/verify_ingestion_fixture.py`

Primary curated artifacts:

- `data/curated/open-datasets/sites_normalized.csv`
- `data/curated/open-datasets/review_candidates.csv`
- `data/curated/open-datasets/review_resolutions.csv`

## Prerequisites

- repo `.env` available
- `DATABASE_URL` or `PSQL_DATABASE_URL` set
- Python environment with project dependencies available
- PostgreSQL/PostGIS running if you plan to import into the database

## Normal Operator Flow

1. Verify the ingestion fixture first.

Command:

```bash
python3 scripts/harvest/verify_ingestion_fixture.py
```

This should pass before changing ingestion heuristics.

2. Run normalization without re-harvesting if raw files are already current.

Command:

```bash
python3 scripts/harvest/ingest_open_datasets.py --skip-harvest --skip-import
```

Outputs:

- `sites_normalized.csv`
- `review_candidates.csv`
- summary counts for duplicates, subfeature filtering, and review candidates

3. Review ambiguous records.

Inspect:

- `data/curated/open-datasets/review_candidates.csv`

4. Record durable decisions.

Edit:

- `data/curated/open-datasets/review_resolutions.csv`

Supported actions:

- `keep_separate`
- `merge`
- `drop_osm_subfeature`

Rules:

- `merge` requires `keep_slug`
- `keep_separate` leaves both rows in the curated dataset and suppresses that pair from future candidate output
- `drop_osm_subfeature` removes the OpenStreetMap row in the resolved pair

5. Re-run normalization after adding resolutions.

Command:

```bash
python3 scripts/harvest/ingest_open_datasets.py --skip-harvest --skip-import
```

Confirm:

- `review resolutions applied` reflects your changes
- resolved pairs no longer appear in `review_candidates.csv`

6. Run the full import when the curated output looks correct.

Command:

```bash
python3 scripts/harvest/ingest_open_datasets.py --skip-harvest
```

This performs:

- normalization
- review resolution application
- curated artifact generation
- SQL import into `sites`
- import reporting

## Full Harvest Flow

If you need to refresh the raw source exports first:

```bash
python3 scripts/harvest/ingest_open_datasets.py
```

This reruns the OSM and Wikidata harvest scripts before normalization.

## Import Report Expectations

The ingestion command prints metrics including:

- `deduped_rows`
- `created_sites`
- `updated_sites`
- `unchanged_sites`
- `source_links_in_stage`

Healthy idempotent reruns should usually report:

- `created_sites: 0`
- `updated_sites: 0`
- most rows as `unchanged_sites`

## Resolution File Format

Header:

```csv
left_slug,right_slug,action,keep_slug,note
```

Examples:

```csv
left_slug,right_slug,action,keep_slug,note
temple-5c-49,tikal-temple-i,keep_separate,,Different temples near the same core area.
site-a,site-a-osm,merge,site-a,Prefer the canonical Wikidata slug.
main-site,main-site-group-a,drop_osm_subfeature,,Group A is a subfeature, not a separate site.
```

## Validation and Safety Checks

Before committing ingestion changes:

1. Run `python3 scripts/harvest/verify_ingestion_fixture.py`
2. Run `python3 scripts/harvest/ingest_open_datasets.py --skip-harvest --skip-import`
3. Inspect `review_candidates.csv`
4. If importing, confirm `updated_sites` is reasonable
5. Re-run the import once more to confirm idempotent metrics

## Troubleshooting

If fixture verification fails:

- inspect recent heuristic or resolution changes first
- do not trust regenerated curated files until the fixture passes again

If `review resolution references missing normalized slug` appears:

- a saved resolution no longer matches the current normalized slugs
- update or remove that row from `review_resolutions.csv`

If every import bumps `updated_sites`:

- confirm the import SQL still avoids no-op updates in `014_open_sites_import.sql`

If database import fails:

- confirm `.env` is loaded
- confirm `DATABASE_URL` or `PSQL_DATABASE_URL` is set
- confirm local Postgres is reachable

## Suggested Commit Discipline

Prefer separate commits for:

- heuristic changes
- curated CSV regeneration
- review resolution decisions
- SQL import/reporting changes
- docs and runbook updates
