#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="${SEASKETCH_DB_CONTAINER:-seasketch_db}"
DB_NAME="${SEASKETCH_DB_NAME:-seasketch}"
DB_USER="${SEASKETCH_DB_USER:-postgres}"

echo "Applying fresh database setup fixes..."

# Ensure app roles can connect to the restored database.
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "grant connect on database ${DB_NAME} to graphile, anon, seasketch_user, seasketch_superuser;"


# Ensure trigger-invoked functions resolve unqualified symbols during COPY.
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
  "DO \$\$
  BEGIN
    IF to_regprocedure('public.changelog_row_net_zero_changes(change_log_field_group,jsonb,jsonb,jsonb,jsonb)') IS NOT NULL THEN
      EXECUTE 'alter function public.changelog_row_net_zero_changes(p_field_group change_log_field_group, p_from_summary jsonb, p_to_summary jsonb, p_from_blob jsonb, p_to_blob jsonb) set search_path = public, pg_catalog';
    END IF;
    IF to_regprocedure('public.create_bbox(geometry)') IS NOT NULL THEN
      EXECUTE 'alter function public.create_bbox(geom geometry) set search_path = public, pg_catalog';
    END IF;
    IF to_regprocedure('public.create_bbox(geometry,integer)') IS NOT NULL THEN
      EXECUTE 'alter function public.create_bbox(geom geometry, sketch_id integer) set search_path = public, pg_catalog';
    END IF;
    IF to_regprocedure('public.generate_export_id(integer,text,jsonb)') IS NOT NULL THEN
      EXECUTE 'alter function public.generate_export_id(id integer, export_id text, body jsonb) set search_path = public, pg_catalog';
    END IF;
    IF to_regprocedure('public.generate_label(integer,jsonb)') IS NOT NULL THEN
      EXECUTE 'alter function public.generate_label(id integer, body jsonb) set search_path = public, pg_catalog';
    END IF;
    IF to_regprocedure('public.toc_to_tsvector(text,text,jsonb,jsonb)') IS NOT NULL THEN
      EXECUTE 'alter function public.toc_to_tsvector(lang text, title text, metadata jsonb, translated_props jsonb) set search_path = public, pg_catalog';
    END IF;
  END
  \$\$;"

echo "Fresh database setup complete."
