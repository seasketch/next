#!/usr/bin/env bash
# Ready when the Docker init script has created the graphile role, not merely when the port accepts connections.
set -euo pipefail

CONTAINER_NAME="${SEASKETCH_DB_CONTAINER:-seasketch_db}"
attempts="${SEASKETCH_DB_WAIT_ATTEMPTS:-60}"

# The image starts a temporary server for init scripts, then restarts. The
# graphile role exists during that first server, so a single success is not
# enough. "ready to accept connections" is logged once per server.
ready_messages() {
  docker logs "$CONTAINER_NAME" 2>&1 | grep -c "ready to accept connections" || true
}

role_ready() {
  docker exec "$CONTAINER_NAME" psql -U postgres -d postgres -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname = 'graphile'" 2>/dev/null | grep -q 1
}

for ((i = 1; i <= attempts; i++)); do
  if [[ "$(ready_messages)" -ge 2 ]] && role_ready; then
    exit 0
  fi
  sleep 1
done

echo "Postgres did not become ready: role graphile was missing after ${attempts}s" >&2
exit 1
