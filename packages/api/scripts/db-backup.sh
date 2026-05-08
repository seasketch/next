#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups/db"
CONTAINER_NAME="${SEASKETCH_DB_CONTAINER:-seasketch_db}"
DB_NAME="${SEASKETCH_DB_NAME:-seasketch}"
DB_USER="${SEASKETCH_DB_USER:-postgres}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date +"%Y%m%d-%H%M%S")"
backup_file="$BACKUP_DIR/${DB_NAME}-${timestamp}.dump"

echo "Creating data-only backup: $backup_file"
docker exec "$CONTAINER_NAME" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --data-only \
  --schema=public \
  --format=custom \
  > "$backup_file"

echo "Data-only backup complete."
echo "$backup_file"
