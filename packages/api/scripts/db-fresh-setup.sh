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

# Reapply smart comments needed for PostGraphile naming stability.
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
  "DO \$\$
  BEGIN
    IF to_regprocedure('public.delete_offline_tile_package(uuid)') IS NOT NULL THEN
      EXECUTE 'comment on function public.delete_offline_tile_package(id uuid) is E''@name deleteOfflineTilePackageFn''';
    END IF;
    IF to_regprocedure('public.delete_report_tab(integer,integer)') IS NOT NULL THEN
      EXECUTE 'comment on function public.delete_report_tab(tab_id integer, move_cards_to_tab_id integer) is E''@name deleteReportTabFn''';
    END IF;
    IF to_regprocedure('public.update_google_maps_tile_api_session(text,text,text,timestamp with time zone,text,integer,integer,text)') IS NOT NULL THEN
      EXECUTE 'comment on function public.update_google_maps_tile_api_session(p_map_type text, p_language text, p_region text, p_expires_at timestamp with time zone, p_session text, p_tile_width integer, p_tile_height integer, p_image_format text) is E''@name updateGoogleMapsTileApiSessionFn''';
    END IF;
    IF to_regprocedure('public.project_background_jobs_esri_feature_layer_conversion_task(public.project_background_jobs)') IS NOT NULL THEN
      EXECUTE 'comment on function public.project_background_jobs_esri_feature_layer_conversion_task(job public.project_background_jobs) is E''@fieldName esriFeatureLayerConversionTaskComputed''';
    END IF;
  END
  \$\$;"

docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
  "DO \$\$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'esri_feature_layer_conversion_tasks'
        AND c.conname = 'esri_feature_layer_conversion_ta_project_background_job_id_fkey'
    ) THEN
      EXECUTE 'comment on constraint esri_feature_layer_conversion_ta_project_background_job_id_fkey on public.esri_feature_layer_conversion_tasks is E''@foreignSingleFieldName esriFeatureLayerConversionTaskByJob''';
    END IF;
  END
  \$\$;"

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
