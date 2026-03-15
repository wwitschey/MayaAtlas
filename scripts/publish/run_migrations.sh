#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/packages/db/migrations"

if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  source "$REPO_ROOT/.env"
  set +a
fi

if [ -z "${PSQL_DATABASE_URL:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  PSQL_DATABASE_URL="${DATABASE_URL/postgresql+psycopg:/postgresql:}"
fi

: "${PSQL_DATABASE_URL:?PSQL_DATABASE_URL or DATABASE_URL is not set. Define one in .env or export it in your shell.}"

run_migration() {
  local file="$1"

  if [ ! -f "$file" ]; then
    echo "Migration file not found: $file" >&2
    exit 1
  fi

  echo "Applying $(basename "$file")"
  psql "$PSQL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
}

if [ "$#" -eq 0 ]; then
  while IFS= read -r file; do
    run_migration "$file"
  done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort)
  exit 0
fi

for arg in "$@"; do
  case "$arg" in
    /*)
      run_migration "$arg"
      ;;
    *)
      run_migration "$MIGRATIONS_DIR/$arg"
      ;;
  esac
done
