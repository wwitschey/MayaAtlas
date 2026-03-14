#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  source "$REPO_ROOT/.env"
  set +a
fi

: "${PSQL_DATABASE_URL:?PSQL_DATABASE_URL is not set. Define it in .env or export it in your shell.}"

NORMALIZED_FILE="${1:-$REPO_ROOT/data/curated/open-datasets/sites_normalized.csv}"

psql "$PSQL_DATABASE_URL" -f "$REPO_ROOT/packages/db/migrations/012_open_dataset_sources.sql"
psql "$PSQL_DATABASE_URL" -f "$REPO_ROOT/packages/db/migrations/013_open_sites_stage.sql"
psql "$PSQL_DATABASE_URL" -f "$REPO_ROOT/packages/db/migrations/015_site_source_links.sql"

psql "$PSQL_DATABASE_URL" -c "TRUNCATE TABLE open_sites_stage;"

psql "$PSQL_DATABASE_URL" -c "\copy open_sites_stage(slug,canonical_name,display_name,longitude,latitude,site_type,country_code,short_description,source) FROM '$NORMALIZED_FILE' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"

psql "$PSQL_DATABASE_URL" -f "$REPO_ROOT/packages/db/migrations/014_open_sites_import.sql"