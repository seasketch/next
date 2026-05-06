#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups/db"
CONTAINER_NAME="${SEASKETCH_DB_CONTAINER:-seasketch_db}"
DB_NAME="${SEASKETCH_DB_NAME:-seasketch}"
DB_USER="${SEASKETCH_DB_USER:-postgres}"

confirm_flag="${SEASKETCH_DB_RESTORE_CONFIRM:-}"
input_backup=""

for arg in "$@"; do
  case "$arg" in
    --yes)
      confirm_flag="yes"
      ;;
    *)
      if [[ -z "$input_backup" ]]; then
        input_backup="$arg"
      else
        echo "Unexpected argument: $arg"
        echo "Usage: npm run db:restore -- [backup-path] [--yes]"
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$input_backup" ]]; then
  input_backup="$(ls -t "$BACKUP_DIR"/"${DB_NAME}"-*.dump 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$input_backup" ]]; then
  echo "No backup file found. Create one first with npm run db:backup"
  exit 1
fi

if [[ "$input_backup" != /* ]]; then
  input_backup="$ROOT_DIR/$input_backup"
fi

if [[ ! -f "$input_backup" ]]; then
  echo "Backup file not found: $input_backup"
  exit 1
fi

echo "Restoring backup: $input_backup"
echo "Target database: $DB_NAME"
echo ""
echo "This will delete and replace your local database by running:"
echo "  1) db:reset"
echo "  2) db:migrate"
echo "  3) data-only restore from the selected dump"
echo ""

if [[ "${confirm_flag}" != "yes" ]]; then
  read -r -p "Type RESTORE to continue: " confirmation
  if [[ "$confirmation" != "RESTORE" ]]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

echo "Resetting and migrating database..."
npm run db:reset -- --erase
npm run db:migrate

echo "Running fresh database setup..."
bash "$ROOT_DIR/scripts/db-fresh-setup.sh"

echo "Clearing migrated table data before restore..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
  "DO \$\$
DECLARE
  truncate_sql text;
BEGIN
  SELECT
    'TRUNCATE TABLE ' ||
    string_agg(format('%I.%I', n.nspname, c.relname), ', ') ||
    ' RESTART IDENTITY CASCADE'
  INTO truncate_sql
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'e'
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND d.objid IS NULL;

  IF truncate_sql IS NOT NULL THEN
    EXECUTE truncate_sql;
  END IF;
END
\$\$;"

echo "Restoring table data..."
docker exec -e PGOPTIONS="-c search_path=public" -i "$CONTAINER_NAME" pg_restore \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --data-only \
  --schema=public \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  < "$input_backup"

echo "Data restore complete."
