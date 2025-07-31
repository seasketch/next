-- Enter migration here
drop table if exists spatial_metrics;
drop type if exists spatial_metric_type;

create type spatial_metric_type as enum ('area', 'count', 'presence', 'presence_table', 'number_stats');

create table spatial_metrics (
  id bigint generated always as identity primary key,
  subject_fragment_id text references fragments(hash) on delete cascade,
  subject_geography_id int references project_geography(id) on delete cascade,
  type text not null,
  overlay_layer_stable_id text,
  overlay_source_remote text,
  overlay_group_by text,
  included_properties text[],
  value jsonb,
  constraint spatial_metrics_exclusive_reference 
    check (
      (subject_fragment_id is not null and subject_geography_id is null) or
      (subject_fragment_id is null and subject_geography_id is not null)
    )
);
