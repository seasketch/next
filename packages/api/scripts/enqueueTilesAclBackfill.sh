#!/usr/bin/env bash
# Enqueue scheduleTilesAclBackfill on graphile-worker (API fans out per project).
# Bastion-friendly: needs only psql + DB env from /etc/profile.d/pg.sh.
set -euo pipefail

SQL="
  select graphile_worker.add_job(
    'scheduleTilesAclBackfill',
    '{}'::json,
    job_key := 'scheduleTilesAclBackfill:manual',
    max_attempts := 1
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
  job_id="$(run_docker_psql)"
else
  cat >&2 <<'EOF'
Cannot reach Postgres.

  Production: run on the maintenance bastion:
    cd packages/infra && npm run shell
    cd /usr/src/app/next/packages/api && npm run tiles-acl:backfill

  Local: start the DB (npm run db:start) so docker container seasketch_db is up.
EOF
  exit 1
fi

echo "Enqueued scheduleTilesAclBackfill (job id=${job_id})."
echo "The API worker will enqueue one backfillTilesAclDocs job per project."
echo "Watch progress with:"
echo "  select count(*) from graphile_worker.jobs"
echo "  where task_identifier = 'backfillTilesAclDocs'"
echo "    and queue_name = 'tiles_acl_backfill';"
