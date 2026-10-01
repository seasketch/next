#!/usr/bin/env bash
# Build a curated non-production database and write the local golden snapshot.
# Reads data-library templates from the developer's database and does not modify it.
# The dump contains a private signing key, so it is gitignored.
# Pass --publish to upload it to R2.
set -euo pipefail

API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="${SEASKETCH_DB_CONTAINER:-seasketch_db}"
SOURCE_DB="seasketch_snapshot_src"
DUMP_PATH="$API_DIR/snapshots/golden.dump"
MANIFEST_PATH="$API_DIR/snapshots/golden.manifest.json"
SOURCE_URL="postgres://postgres:password@localhost:54321/${SOURCE_DB}"
LIBRARY_DB="${SNAPSHOT_LIBRARY_DB:-seasketch}"
publish=0

for arg in "$@"; do
  case "$arg" in
    --publish)
      publish=1
      ;;
    *)
      echo "Unexpected argument: $arg" >&2
      echo "Usage: npm run snapshot:create -- [--publish]" >&2
      exit 1
      ;;
  esac
done

psql_exec() {
  docker exec -i "$CONTAINER_NAME" psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

echo "Starting Postgres and Redis..."
docker compose -f "$API_DIR/docker-compose.yml" up -d
bash "$SCRIPT_DIR/wait-for-postgres.sh"

echo "Recreating ${SOURCE_DB}. The seasketch database is not touched."
psql_exec -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${SOURCE_DB}' AND pid <> pg_backend_pid();" \
  >/dev/null
psql_exec -d postgres -c "DROP DATABASE IF EXISTS ${SOURCE_DB};"
psql_exec -d postgres -c "CREATE DATABASE ${SOURCE_DB} OWNER graphile_migrate;"
psql_exec -d postgres -f - < "$SCRIPT_DIR/ensure-app-roles.sql"

echo "Applying committed migrations to ${SOURCE_DB}. This replays the full history once."
(
  cd "$API_DIR"
  IN_TESTS=1 ADMIN_DATABASE_URL="$SOURCE_URL" npm run db:migrate --silent
)

echo "Applying fresh-database function fixes..."
SEASKETCH_DB_NAME="$SOURCE_DB" SEASKETCH_DB_CONTAINER="$CONTAINER_NAME" bash "$SCRIPT_DIR/db-fresh-setup.sh"

echo "Installing the graphile-worker schema..."
(
  cd "$API_DIR"
  SOURCE_URL="$SOURCE_URL" node -e '
    const { runMigrations } = require("graphile-worker");
    runMigrations({ connectionString: process.env.SOURCE_URL })
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  '
)

echo "Inserting fixture projects and seed users..."
psql_exec -d "$SOURCE_DB" -f - < "$API_DIR/snapshots/fixtures.sql"

echo "Generating a signing key..."
(
  cd "$API_DIR"
  node "$SCRIPT_DIR/snapshot-seed-jwks.js"
) | psql_exec -d "$SOURCE_DB" -f -

SNAPSHOT_SOURCE_DB="$SOURCE_DB" SNAPSHOT_LIBRARY_DB="$LIBRARY_DB" \
  bash "$SCRIPT_DIR/copy-data-library.sh"

migration="$(psql_exec -d "$SOURCE_DB" -tAc \
  "SELECT filename FROM graphile_migrate.migrations ORDER BY filename DESC LIMIT 1")"
if [[ -z "$migration" ]]; then
  echo "Snapshot source has no committed migrations recorded." >&2
  exit 1
fi

demo="$(psql_exec -d "$SOURCE_DB" -tAc \
  "SELECT slug FROM projects WHERE slug = 'demo-public'")"
if [[ "$demo" != "demo-public" ]]; then
  echo "Snapshot source is missing demo-public." >&2
  exit 1
fi

mkdir -p "$API_DIR/snapshots"
echo "Writing ${DUMP_PATH} at migration ${migration}..."
docker exec "$CONTAINER_NAME" pg_dump \
  -U postgres \
  -d "$SOURCE_DB" \
  --format=custom \
  --no-owner \
  > "$DUMP_PATH"

if [[ ! -s "$DUMP_PATH" ]]; then
  echo "Snapshot dump is empty." >&2
  exit 1
fi

commit="$(git -C "$API_DIR" rev-parse HEAD)"
dirty="false"
if [[ -n "$(git -C "$API_DIR" status --porcelain)" ]]; then
  dirty="true"
fi
created_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
templates="$(psql_exec -d "$SOURCE_DB" -tAc "SELECT coalesce(string_agg(data_library_template_id, ',' ORDER BY data_library_template_id), '') FROM table_of_contents_items t JOIN projects p ON p.id = t.project_id WHERE p.slug = 'superuser' AND t.data_library_template_id IS NOT NULL")"

SNAPSHOT_MIGRATION="$migration" \
SNAPSHOT_CREATED_AT="$created_at" \
SNAPSHOT_COMMIT="$commit" \
SNAPSHOT_DIRTY="$dirty" \
SNAPSHOT_TEMPLATES="$templates" \
SNAPSHOT_DUMP="$DUMP_PATH" \
node -e '
const fs = require("fs");
const crypto = require("crypto");
const dump = fs.readFileSync(process.env.SNAPSHOT_DUMP);
const manifest = {
  format: "pg_dump-custom",
  migration: process.env.SNAPSHOT_MIGRATION,
  createdAt: process.env.SNAPSHOT_CREATED_AT,
  commit: process.env.SNAPSHOT_COMMIT,
  dirty: process.env.SNAPSHOT_DIRTY === "true",
  sha256: crypto.createHash("sha256").update(dump).digest("hex"),
  dataLibraryTemplates: (process.env.SNAPSHOT_TEMPLATES || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
  note: "Golden snapshot. Contains a private signing key. Fetched from R2 by npm run setup."
};
fs.writeFileSync(process.argv[1], JSON.stringify(manifest, null, 2) + "\n");
' "$MANIFEST_PATH"

psql_exec -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${SOURCE_DB}' AND pid <> pg_backend_pid();" \
  >/dev/null
psql_exec -d postgres -c "DROP DATABASE ${SOURCE_DB};"

echo "Golden snapshot written."
echo "$DUMP_PATH"
echo "$MANIFEST_PATH"

if [[ "$publish" -eq 1 ]]; then
  (cd "$API_DIR" && node "$SCRIPT_DIR/snapshot-r2.js" push)
fi
