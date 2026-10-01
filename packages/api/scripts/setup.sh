#!/usr/bin/env bash
# Start Postgres and Redis, fetch the golden snapshot when the local copy is
# missing or older, restore it into an empty database, then migrate forward.
# Does not drop a database that already has migrations. Pass --reset to wipe.
set -euo pipefail

API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="${SEASKETCH_DB_CONTAINER:-seasketch_db}"
DB_NAME="${SEASKETCH_DB_NAME:-seasketch}"
DUMP_PATH="$API_DIR/snapshots/golden.dump"
reset=0

for arg in "$@"; do
  case "$arg" in
    --reset)
      reset=1
      ;;
    *)
      echo "Unexpected argument: $arg" >&2
      echo "Usage: npm run setup -- [--reset]" >&2
      exit 1
      ;;
  esac
done

if [[ ! "$DB_NAME" =~ ^[a-z][a-z0-9_]*$ ]]; then
  echo "Refusing database name: $DB_NAME" >&2
  exit 1
fi

psql_exec() {
  docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

database_exists() {
  [[ "$(psql_exec -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'")" == "1" ]]
}

has_migrations() {
  [[ "$(psql_exec -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'graphile_migrate' AND table_name = 'migrations')")" == "t" ]] \
    && [[ "$(psql_exec -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT 1 FROM graphile_migrate.migrations)")" == "t" ]]
}

migrate_forward() {
  echo "Applying migrations newer than the database..."
  if [[ "$DB_NAME" == "seasketch" ]]; then
    (cd "$API_DIR" && npm run db:migrate --silent)
  else
    (
      cd "$API_DIR"
      ADMIN_DATABASE_URL="postgres://postgres:password@localhost:54321/${DB_NAME}" npm run db:migrate --silent
    )
  fi
}

pull_snapshot() {
  local status=0
  (cd "$API_DIR" && node "$SCRIPT_DIR/snapshot-r2.js" pull) || status=$?
  if [[ "$status" -eq 0 ]]; then
    return 0
  fi
  if [[ -s "$DUMP_PATH" ]]; then
    echo "Could not fetch the golden snapshot. Using the local copy." >&2
    return 0
  fi
  echo "Could not fetch the golden snapshot and no local copy exists." >&2
  return 1
}

restore_snapshot() {
  if [[ ! -s "$DUMP_PATH" ]]; then
    echo "No golden snapshot at ${DUMP_PATH}." >&2
    exit 1
  fi
  echo "Restoring ${DUMP_PATH} into ${DB_NAME}..."
  psql_exec -d postgres -f - < "$SCRIPT_DIR/ensure-app-roles.sql"
  # Extensions in the dump are created in public, and pg_dump does not emit
  # CREATE SCHEMA public. Drop only the schemas the dump itself creates.
  psql_exec -d "$DB_NAME" -c "DROP SCHEMA IF EXISTS app_private CASCADE; DROP SCHEMA IF EXISTS graphile_migrate CASCADE; DROP SCHEMA IF EXISTS graphile_worker CASCADE;"
  # Data is loaded with triggers off. Several triggers call functions whose
  # search_path is unset, which fails mid-COPY. db-fresh-setup repairs that
  # for later writes and grants connect to the app roles.
  pg_restore_section() {
    docker exec -i "$CONTAINER_NAME" pg_restore \
      -U postgres \
      -d "$DB_NAME" \
      --no-owner \
      --exit-on-error \
      --single-transaction \
      "$@" \
      < "$DUMP_PATH"
  }
  pg_restore_section --section=pre-data
  SEASKETCH_DB_NAME="$DB_NAME" SEASKETCH_DB_CONTAINER="$CONTAINER_NAME" bash "$SCRIPT_DIR/db-fresh-setup.sh"
  pg_restore_section --section=data --disable-triggers
  pg_restore_section --section=post-data
}

drop_database() {
  echo "Dropping database ${DB_NAME}."
  psql_exec -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    >/dev/null
  psql_exec -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
}

pull_snapshot

echo "Starting Postgres and Redis..."
docker compose -f "$API_DIR/docker-compose.yml" up -d
bash "$SCRIPT_DIR/wait-for-postgres.sh"

if [[ "$reset" -eq 1 ]]; then
  drop_database
fi

if ! database_exists; then
  echo "Creating empty database ${DB_NAME}..."
  psql_exec -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER graphile_migrate;"
fi

if [[ "$reset" -eq 0 ]] && has_migrations; then
  echo "Database ${DB_NAME} already has migrations. Leaving it in place."
  echo "Run npm run setup -- --reset to replace it with the golden snapshot."
  migrate_forward
  exit 0
fi

if ! restore_snapshot; then
  echo "Restore failed. Dropping incomplete database ${DB_NAME}." >&2
  drop_database
  exit 1
fi
migrate_forward

echo "Database ${DB_NAME} is ready."
