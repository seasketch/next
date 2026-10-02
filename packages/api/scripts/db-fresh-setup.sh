#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="${SEASKETCH_DB_CONTAINER:-seasketch_db}"
DB_NAME="${SEASKETCH_DB_NAME:-seasketch}"
DB_USER="${SEASKETCH_DB_USER:-postgres}"

echo "Applying fresh database setup fixes..."

# The database name is not known to the migrations (000055 grants on the
# literal name "seasketch"), so connect has to be granted here.
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "grant connect on database ${DB_NAME} to graphile, anon, seasketch_user, seasketch_superuser;"

echo "Fresh database setup complete."
