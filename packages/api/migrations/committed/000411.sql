--! Previous: sha1:641955cd9479b7ad1cef6355395a790a78665593
--! Hash: sha1:f7ea41a5a51653678faad311a582ed80dfa71da8

-- Enter migration here
create or replace function extract_raster_band_count_from_geostats(geostats jsonb)
  returns integer
  language sql
  immutable
  as $$
  select jsonb_array_length(geostats->'bands')::integer;
  $$;

grant execute on function extract_raster_band_count_from_geostats(jsonb) to anon;

alter table data_sources add column if not exists raster_band_count integer generated always as (extract_raster_band_count_from_geostats(geostats)) stored;

create or replace function extract_vector_geometry_type_from_geostats(geostats jsonb)
  returns text
  language sql
  immutable
  as $$
  select (jsonb_path_query_first(geostats, '$.layers[0].geometry'))->>0
  $$;

grant execute on function extract_vector_geometry_type_from_geostats(jsonb) to anon;

alter table data_sources add column if not exists vector_geometry_type text generated always as (extract_vector_geometry_type_from_geostats(geostats)) stored;

alter table data_sources add column if not exists feature_count integer generated always as ((geostats->'layers'->0->>'count')::integer) stored;

create or replace function extract_column_details_from_geostats(geostats jsonb)
  returns jsonb
  language sql
  immutable
  as $$
  -- returns a Record<attribute, props> with the following properties:
  -- - type: "string"
  -- - countDistinct: number
  select jsonb_object_agg(attr->>'attribute', jsonb_build_object(
    'type', attr->>'type',
    'countDistinct', attr->>'countDistinct'
  )) from jsonb_array_elements(geostats->'layers'->0->'attributes') as attr;
  $$;

grant execute on function extract_column_details_from_geostats(jsonb) to anon;

alter table data_sources add column if not exists column_details jsonb generated always as (extract_column_details_from_geostats(geostats)) stored;

alter table data_sources drop column if exists columns;
