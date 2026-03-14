#!/usr/bin/env bash
set -euo pipefail

RAW_FILE="${1:-data/raw/witschey-brown/witschey_brown_raw.csv}"
NORMALIZED_FILE="data/curated/witschey-brown/sites_normalized.csv"

python3 scripts/ingest/ingest_witschey_brown.py \
  --input "$RAW_FILE" \
  --output "$NORMALIZED_FILE"

psql "$DATABASE_URL" -f packages/db/migrations/009_witschey_brown_source.sql
psql "$DATABASE_URL" -f packages/db/migrations/010_witschey_brown_stage.sql
psql "$DATABASE_URL" -v normalized_csv="$NORMALIZED_FILE" -f packages/db/migrations/011_witschey_brown_import.sql