-- Enter migration here
alter table data_sources add column if not exists best_label_column text;
alter table data_sources add column if not exists best_category_column text;
alter table data_sources add column if not exists best_numeric_column text;
alter table data_sources add column if not exists best_date_column text;
alter table data_sources add column if not exists best_popup_description_column text;
alter table data_sources add column if not exists best_id_column text;
alter table data_sources add column if not exists junk_columns text[];
alter table data_sources add column if not exists ai_cartographer_rationale text;
alter table data_sources add column if not exists column_intelligence_collected boolean not null default false;
alter table data_sources drop column if exists best_presentation_type;
drop type if exists visualization_type cascade;
create type visualization_type as enum (
  'RGB_RASTER',
  'CATEGORICAL_RASTER',
  'CONTINUOUS_RASTER',
  'SIMPLE_POLYGON',
  'CATEGORICAL_POLYGON',
  'CONTINUOUS_POLYGON',
  'SIMPLE_POINT',
  'MARKER_IMAGE',
  'CATEGORICAL_POINT',
  'PROPORTIONAL_SYMBOL',
  'CONTINUOUS_POINT',
  'HEATMAP'
);
alter table data_sources add column if not exists best_presentation_type visualization_type;

-- Distinct attribute/column names from vector geostats (layers[].attributes[].attribute).
-- Empty array for raster geostats (non-empty bands[]) or non–vector-shaped payloads.
create or replace function get_geostats_attribute_column_names(geostats jsonb)
returns text[]
language sql
immutable
as $$
  select case
    when geostats is null then array[]::text[]
    when geostats ? 'bands'
      and jsonb_typeof(geostats->'bands') = 'array'
      and jsonb_array_length(geostats->'bands') > 0 then
      array[]::text[]
    when jsonb_typeof(geostats->'layers') <> 'array'
      or jsonb_array_length(geostats->'layers') = 0 then
      array[]::text[]
    when exists (
      select 1
      from jsonb_array_elements(geostats->'layers') as layer
      where jsonb_typeof(layer) <> 'object'
        or jsonb_typeof(layer->'attributes') <> 'array'
    ) then
      array[]::text[]
    else
      coalesce(
        (
          select array_agg(attr order by attr)
          from (
            select distinct elem->>'attribute' as attr
            from jsonb_array_elements(geostats->'layers') as layer,
              jsonb_array_elements(layer->'attributes') as elem
            where elem->>'attribute' is not null
              and elem->>'attribute' <> ''
          ) s
        ),
        array[]::text[]
      )
  end;
$$;

grant execute on function get_geostats_attribute_column_names(jsonb) to anon;

alter table data_sources add column if not exists columns text[] generated always as (get_geostats_attribute_column_names(geostats)) stored;

alter table data_sources add column if not exists is_single_band_raster boolean generated always as (jsonb_typeof(geostats->'bands') = 'array' and jsonb_array_length(geostats->'bands') = 1) stored;