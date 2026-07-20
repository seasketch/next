#!/usr/bin/env bash
# Enqueue refreshOverlayEngineAccessToken on graphile-worker.
#
# Production (maintenance bastion): uses psql + IAM DB auth from pg.sh.
# Local: falls back to docker exec seasketch_db (local JWKS — not valid in prod).
set -euo pipefail

SQL="
  select graphile_worker.add_job(
    'refreshOverlayEngineAccessToken',
    '{}'::json,
    job_key := 'refreshOverlayEngineAccessToken:manual',
    max_attempts := 3
  );
"

run_psql() {
  psql -v ON_ERROR_STOP=1 -At -c "$SQL"
}

run_docker_psql() {
  docker exec seasketch_db psql -U postgres seasketch -v ON_ERROR_STOP=1 -At -c "$SQL"
}

if command -v psql >/dev/null 2>&1; then
  job_id="$(run_psql)"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -qx seasketch_db; then
  echo "No psql on PATH; using local docker seasketch_db." >&2
  echo "Warning: a token minted against local JWKS will not validate in production." >&2
  echo "For prod, run this on the maintenance bastion (npm run shell)." >&2
  job_id="$(run_docker_psql)"
else
  cat >&2 <<'EOF'
Cannot reach Postgres.

  Production: run on the maintenance bastion:
    cd packages/infra && npm run shell
    # then, after pg.sh has set DB env:
    cd /usr/src/app/next/packages/api && npm run overlay-engine:token

  Local: start the DB (npm run db:start) so docker container seasketch_db is up.
EOF
  exit 1
fi

echo "Enqueued refreshOverlayEngineAccessToken (job id=${job_id})."
echo "The API graphile-worker will mint and publish to Secrets Manager."
echo "After a few seconds: npm run overlay-engine:token:show"
