#!/usr/bin/env bash
# Copy superuser data-library templates from the developer's database into the
# snapshot source database. Does not modify the developer's database.
set -euo pipefail

API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="${SEASKETCH_DB_CONTAINER:-seasketch_db}"
SOURCE_DB="${SNAPSHOT_SOURCE_DB:?SNAPSHOT_SOURCE_DB is required}"
LIBRARY_DB="${SNAPSHOT_LIBRARY_DB:-seasketch}"

if [[ "$SOURCE_DB" == "$LIBRARY_DB" ]]; then
  echo "Refusing to copy the data library onto itself." >&2
  exit 1
fi

psql_exec() {
  local db="$1"
  shift
  docker exec -i "$CONTAINER_NAME" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"
}

stage_table() {
  local table="$1"
  local where="$2"
  echo "Staging ${table}..."
  psql_exec "$SOURCE_DB" -c "DROP TABLE IF EXISTS library_stage.${table}; CREATE TABLE library_stage.${table} (LIKE public.${table});"
  docker exec "$CONTAINER_NAME" psql -U postgres -d "$LIBRARY_DB" -v ON_ERROR_STOP=1 \
    -c "COPY (SELECT * FROM public.${table} WHERE ${where}) TO STDOUT" \
    | psql_exec "$SOURCE_DB" -c "COPY library_stage.${table} FROM STDIN"
}

template_where="project_id = (SELECT id FROM projects WHERE slug = 'superuser') AND data_library_template_id IS NOT NULL"
layer_where="id IN (SELECT data_layer_id FROM table_of_contents_items WHERE ${template_where} AND data_layer_id IS NOT NULL)"
archived_where="data_layer_id IN (SELECT id FROM data_layers WHERE ${layer_where})"
source_where="id IN (SELECT data_source_id FROM data_layers WHERE ${layer_where} AND data_source_id IS NOT NULL UNION SELECT data_source_id FROM archived_data_sources WHERE ${archived_where})"
settings_where="id IN (SELECT interactivity_settings_id FROM data_layers WHERE ${layer_where} AND interactivity_settings_id IS NOT NULL)"
toc_where="${template_where}"
acl_where="table_of_contents_item_id IN (SELECT id FROM table_of_contents_items WHERE ${template_where})"
output_where="data_source_id IN (SELECT id FROM data_sources WHERE ${source_where})"
notes_where="data_source_id IN (SELECT id FROM data_sources WHERE ${source_where})"

echo "Copying data library templates from ${LIBRARY_DB} into ${SOURCE_DB}..."
psql_exec "$SOURCE_DB" -c "CREATE SCHEMA IF NOT EXISTS library_stage;"
psql_exec "$SOURCE_DB" <<'SQL'
CREATE OR REPLACE FUNCTION library_stage.copy_in(target text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  cols text;
  override text := '';
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = target
    AND is_generated = 'NEVER';
  IF cols IS NULL THEN
    RAISE EXCEPTION 'no columns for %', target;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = target AND is_identity = 'YES'
  ) THEN
    override := ' OVERRIDING SYSTEM VALUE';
  END IF;
  EXECUTE format(
    'INSERT INTO public.%I (%s)%s SELECT %s FROM library_stage.%I',
    target, cols, override, cols, target
  );
END
$$;
SQL

stage_table interactivity_settings "$settings_where"
stage_table data_sources "$source_where"
stage_table data_layers "$layer_where"
stage_table table_of_contents_items "$toc_where"
stage_table access_control_lists "$acl_where"
stage_table data_upload_outputs "$output_where"
stage_table archived_data_sources "$archived_where"
stage_table ai_data_analyst_notes "$notes_where"

psql_exec "$SOURCE_DB" -f - < "$API_DIR/snapshots/import-data-library.sql"

count="$(psql_exec "$SOURCE_DB" -tAc "SELECT count(*) FROM table_of_contents_items t JOIN projects p ON p.id = t.project_id WHERE p.slug = 'superuser' AND t.data_library_template_id IS NOT NULL")"
echo "Data library templates in snapshot source: ${count}"
if [[ "$count" -lt 1 ]]; then
  echo "Data library copy produced no templates." >&2
  exit 1
fi

psql_exec "$SOURCE_DB" -c "DROP SCHEMA library_stage CASCADE;"
