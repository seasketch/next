--! Previous: sha1:5a121ffbecd4ef38ef0cfe56433328d5d5c3dd39
--! Hash: sha1:70af5c278ab4307d6445e6dcce482838d3d4ef96

-- Enter migration here
drop table if exists archived_data_sources;

create table archived_data_sources (
  data_source_id integer not null references data_sources(id) on delete cascade,
  data_layer_id integer not null references data_layers(id) on delete cascade,
  version integer not null,
  mapbox_gl_style jsonb not null,
  sprite_ids integer[] generated always as (extract_sprite_ids(mapbox_gl_style::text)) stored,
  changelog text,
  primary key (data_source_id, data_layer_id, version)
);

grant select on archived_data_sources to seasketch_user;

alter table archived_data_sources enable row level security;

create policy select_archived_data_sources_policy on archived_data_sources for select using (session_is_admin((select project_id from data_sources where id = data_source_id)));

COMMENT ON CONSTRAINT archived_data_sources_data_source_id_fkey ON public.archived_data_sources IS '
@simpleCollections only
';

comment on table archived_data_sources is 'Admins can upload new version of data sources, and these are tracked from this table. This is used to track changes to data sources over time with a version number and optional changelog.';

comment on column archived_data_sources.version is 'Version number of the data source. Incremented each time a new version is uploaded.';

comment on column archived_data_sources.mapbox_gl_style is 'Mapbox GL style from the associated data layer at the time of upload of the new version. This is tracked in case the data source is significantly changed such that rolling back to a previous version also requires style changes';

comment on column archived_data_sources.sprite_ids is 'Array of sprite ids used in the archived mapbox_gl_style.';

comment on column archived_data_sources.changelog is 'Optional changelog so that admins can explain what changed in the new version.';

CREATE OR REPLACE FUNCTION public.projects_data_hosting_quota_used(p public.projects) RETURNS bigint
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      sum_bytes bigint;
      quota bigint;
    begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
    select 
      sum(size) 
    into 
      sum_bytes 
    from 
      data_upload_outputs
    where
      data_source_id = any (
        select id from data_sources where id = any (
          select data_source_id from data_layers where id = any (
            select data_layer_id from table_of_contents_items where project_id = p.id and data_layer_id is not null and is_draft = true
          ) union
          select data_source_id from archived_data_sources where data_source_id = any (
            select id from data_sources where project_id = p.id
          )
        )
      );
    select projects_data_hosting_quota(p) into quota;
    if sum_bytes < quota then
      return sum_bytes;
    end if;
    if sum_bytes is null then
      return 0;
    end if;
    return quota;
    end;
  $$;
