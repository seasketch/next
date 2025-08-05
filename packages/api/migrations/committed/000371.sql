--! Previous: sha1:a12134b71567a95beba85213c0c2ac17884a0a7d
--! Hash: sha1:c9e64beb4b007b6ef04d491759e5289512e52587

drop table if exists metric_work_chunk;
drop table if exists spatial_metrics cascade;

drop type if exists spatial_metric_type;
drop type if exists spatial_metric_state;
drop type if exists metric_overlay_type;
drop type if exists metric_execution_environment;

create type spatial_metric_type as enum ('area', 'count', 'presence', 'presence_table', 'contextualized_mean');

create type spatial_metric_state as enum ('queued', 'processing', 'complete', 'error');

create type metric_overlay_type as enum ('vector', 'raster');

create type metric_execution_environment as enum ('lambda', 'api_server');

create table spatial_metrics (
  id bigint generated always as identity primary key,
  subject_fragment_id text references fragments(hash) on delete cascade,
  subject_geography_id int references project_geography(id) on delete cascade,
  type spatial_metric_type not null,
  overlay_layer_stable_id text,
  overlay_source_remote text,
  overlay_group_by text,
  included_properties text[],
  value jsonb,
  state spatial_metric_state not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  overlay_type metric_overlay_type not null,
  constraint spatial_metrics_exclusive_reference 
    check (
      (subject_fragment_id is not null and subject_geography_id is null) or
      (subject_fragment_id is null and subject_geography_id is not null)
    )
);

create table metric_work_chunk (
  id bigint generated always as identity primary key,
  spatial_metric_id bigint references spatial_metrics(id) on delete cascade,
  state spatial_metric_state not null default 'queued',
  error_message text,
  value jsonb,
  total_bytes bigint,
  offsets bigint[],
  -- envelope of geotiff to be overlayed
  bbox geometry(POLYGON, 4326),
  execution_environment metric_execution_environment not null default 'lambda',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function sketches_spatial_metrics(sketch sketches)
  returns setof spatial_metrics
  language sql
  security definer
  stable
  as $$
    select * from spatial_metrics where subject_fragment_id in (select fragment_hash from sketch_fragments where sketch_id = sketch.id)
  $$;

create or replace function project_geography_spatial_metrics(geography project_geography)
  returns setof spatial_metrics
  language sql
  security definer
  stable
  as $$
    select * from spatial_metrics where subject_geography_id = geography.id
  $$;

grant execute on function sketches_spatial_metrics to anon;
grant execute on function project_geography_spatial_metrics to anon;

alter table data_sources alter column normalized_source_bytes type bigint;
