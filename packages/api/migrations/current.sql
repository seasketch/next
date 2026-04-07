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
  reverse_palette boolean not null default false,
  errors text,
  pii_redacted_columns text[] not null default array[]::text[],
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


alter table user_profiles add column if not exists enable_ai_data_analyst boolean not null default false;

alter table user_profiles add column if not exists ai_data_analyst_enabled_at timestamptz;

alter table user_profiles add column if not exists was_prompted_to_enable_ai_data_analyst_at timestamptz;

drop function if exists update_ai_data_analyst_settings;
create or replace function update_ai_data_analyst_settings(enable_ai boolean)
  returns boolean
  language plpgsql
  security definer
  as $$
  begin
    -- if not logged in, throw an error
    if current_setting('session.user_id', true)::int is null then
      raise exception 'Not logged in';
    end if;
    -- update enabled state
    update user_profiles set enable_ai_data_analyst = enable_ai where user_id = current_setting('session.user_id', true)::int;
    -- update enabled_at timestamp, if enabling
    if enable_ai then
      update user_profiles set ai_data_analyst_enabled_at = now() where user_id = current_setting('session.user_id', true)::int;
    end if;
    update user_profiles set was_prompted_to_enable_ai_data_analyst_at = coalesce(was_prompted_to_enable_ai_data_analyst_at, now()) where user_id = current_setting('session.user_id', true)::int;
    return true;
  end;
$$;

grant execute on function update_ai_data_analyst_settings(boolean) to seasketch_user;

create or replace function declined_to_enable_ai_data_analyst()
  returns boolean
  language plpgsql
  security definer
  as $$
  begin
    if current_setting('session.user_id', true)::int is null then
      raise exception 'Not logged in';
    end if;
    update user_profiles set was_prompted_to_enable_ai_data_analyst_at = now() where user_id = current_setting('session.user_id', true)::int;
    return true;
  end;
$$;

grant execute on function declined_to_enable_ai_data_analyst() to seasketch_user;

-- submit_data_upload: client supplies enable_ai_data_analyst (passed through to
-- graphile processDataUpload payload; not read from user_profiles in the worker).
drop function if exists public.submit_data_upload(uuid);

create or replace function public.submit_data_upload(
  id uuid,
  enable_ai_data_analyst boolean default false
) returns public.project_background_jobs
    language plpgsql
    security definer
    as $$
    declare
      job project_background_jobs;
      pid integer;
    begin
      select
        project_id
      into
        pid
      from
        project_background_jobs
      where
        project_background_jobs.id = submit_data_upload.id;
      if session_is_admin(pid) then
        update
          project_background_jobs
        set
          state = 'running',
          progress_message = 'uploaded'
        where
          project_background_jobs.id = submit_data_upload.id
        returning * into job;
        perform graphile_worker.add_job(
          'processDataUpload',
          json_build_object(
            'jobId', job.id,
            'enableAiDataAnalyst', enable_ai_data_analyst
          ),
          max_attempts := 1
        );
        return job;
      else
        raise exception 'permission denied.';
      end if;
    end;
$$;

grant execute on function public.submit_data_upload(uuid, boolean) to seasketch_user;
