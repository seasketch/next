-- Enter migration here
alter table data_sources drop column if exists best_label_column;
alter table data_sources drop column if exists best_category_column;
alter table data_sources drop column if exists best_numeric_column;
alter table data_sources drop column if exists best_date_column;
alter table data_sources drop column if exists best_popup_description_column;
alter table data_sources drop column if exists best_id_column;
alter table data_sources drop column if exists junk_columns;
alter table data_sources drop column if exists ai_cartographer_rationale;
alter table data_sources drop column if exists column_intelligence_collected;
alter table data_sources drop column if exists best_presentation_type;
alter table data_sources drop column if exists chosen_presentation_type;
alter table data_sources drop column if exists chosen_presentation_column;
drop type if exists visualization_type cascade;

alter table data_sources drop column if exists chosen_presentation_type;
alter table data_sources drop column if exists chosen_presentation_column;
alter table data_sources drop column if exists best_layer_title;
alter table data_sources drop column if exists best_layer_title;
drop function if exists get_geostats_attribute_column_names;

alter table data_sources drop column if exists columns;


alter table data_sources add column if not exists is_single_band_raster boolean generated always as (jsonb_typeof(geostats->'bands') = 'array' and jsonb_array_length(geostats->'bands') = 1) stored;

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

drop table if exists ai_data_analyst_notes;

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
  'HEATMAP',
  'SIMPLE_LINE',
  'CONTINUOUS_LINE',
  'CATEGORICAL_LINE'
);

drop type if exists value_steps cascade;

create type value_steps as enum (
  'CONTINUOUS',
  'NATURAL_BREAKS',
  'QUANTILES',
  'EQUAL_INTERVALS'
);

create table ai_data_analyst_notes (
  id int generated always as identity primary key,
  data_source_id int not null references data_sources(id) on delete cascade,
  project_id int not null references projects(id) on delete cascade,
  notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  best_layer_title text,
  attribution text,
  best_label_column text,
  best_category_column text,
  best_numeric_column text,
  best_date_column text,
  best_popup_description_column text,
  best_group_by_column text,
  best_id_column text,
  junk_columns text[],
  chosen_presentation_type visualization_type,
  chosen_presentation_column text,
  palette text,
  custom_palette jsonb,
  show_labels boolean not null default false,
  labels_min_zoom integer,
  interactivity_type interactivity_type not null default 'NONE',
  value_steps value_steps,
  value_steps_n integer,
  errors text,
  constraint ai_data_analyst_notes_one_per_data_source unique (data_source_id)
);

grant select on ai_data_analyst_notes to anon;

alter table ai_data_analyst_notes enable row level security;

create policy ai_data_analyst_notes_select on ai_data_analyst_notes using (
  session_is_admin(project_id)
);

-- allow postgres user to insert/update/delete the notes
create policy ai_data_analyst_notes_admin on ai_data_analyst_notes for all to postgres using (
  true
);

-- update updated_at timestamp on insert/update
create trigger update_updated_at before update on ai_data_analyst_notes for each row execute function trigger_set_timestamp();

