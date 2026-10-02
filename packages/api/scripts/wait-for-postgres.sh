#!/usr/bin/env bash
# Ready when the Docker init script has created the graphile role, not merely when the port accepts connections.
set -euo pipefail

CONTAINER_NAME="${SEASKETCH_DB_CONTAINER:-seasketch_db}"
attempts="${SEASKETCH_DB_WAIT_ATTEMPTS:-60}"

for ((i = 1; i <= attempts; i++)); do
  if docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname = 'graphile'" 2>/dev/null | grep -q 1; then
    exit 0
  fi
  sleep 1
done

echo "Postgres did not become ready: role graphile was missing after ${attempts}s" >&2
exit 1
