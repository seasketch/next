--! Previous: sha1:5ee4e72d4f7f8783cfe5a111000c54384d242908
--! Hash: sha1:841db5c024872ea48c9d94a916b5c035a6e1af33

-- Enter migration here
alter type project_background_job_type add value if not exists 'replacement_upload';

alter table data_upload_tasks add column if not exists replace_source_id integer references data_sources(id) on delete cascade;

alter table archived_data_sources add column if not exists source_layer text;
alter table archived_data_sources add column if not exists project_id integer not null references projects(id) on delete cascade;

drop function if exists create_data_upload;
CREATE OR REPLACE FUNCTION public.create_data_upload(filename text, project_id integer, content_type text, replace_source_id int) RETURNS public.data_upload_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      upload data_upload_tasks;
      used bigint;
      quota bigint;
      job project_background_jobs;
    begin
      if session_is_admin(project_id) then
        select projects_data_hosting_quota_used(projects.*), projects_data_hosting_quota(projects.*) into used, quota from projects where id = project_id;
        -- make sure there are no other active project_background_jobs with the same replace_source_id
        if replace_source_id is not null and (select exists(
          select 
            data_upload_tasks.id 
          from 
            data_upload_tasks 
          inner join 
            project_background_jobs 
          on 
            data_upload_tasks.project_background_job_id = project_background_jobs.id 
          where 
            data_upload_tasks.replace_source_id is not null and 
            project_background_jobs.state in ('queued', 'running') and
            data_upload_tasks.replace_source_id = create_data_upload.replace_source_id
        )) then
          raise exception 'There is already an active upload task for this data source';
        end if;
        if quota - used > 0 then
          insert into project_background_jobs (
            project_id, 
            title, 
            user_id, 
            type,
            timeout_at
          ) values (
            project_id, 
            (
              case when replace_source_id is not null then 'Replacement upload ' else '' end
            ) || filename, 
            nullif(current_setting('session.user_id', TRUE), '')::integer, 
            'data_upload',
            timezone('utc'::text, now()) + interval '15 minutes'
          )
          returning * into job;
          insert into data_upload_tasks(
            filename, 
            content_type, 
            project_background_job_id,
            replace_source_id
          ) values (
            create_data_upload.filename, 
            create_data_upload.content_type, 
            job.id,
            create_data_upload.replace_source_id
          ) returning * into upload;
          return upload;
        else
          raise exception 'data hosting quota exceeded';
        end if;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;
grant execute on function create_data_upload to seasketch_user;

drop function if exists replace_data_source;
create or replace function replace_data_source(data_layer_id integer, data_source_id integer, source_layer text, bounds numeric[], gl_styles jsonb)
  returns void
  language plpgsql
  security definer
  as $$
    declare
      old_source_id integer;
      old_source_type text;
      old_metadata_is_dynamic boolean;
    begin
        select data_layers.data_source_id into old_source_id from data_layers where id = replace_data_source.data_layer_id;
        select type into old_source_type from data_sources where id = old_source_id;
        select metadata is null and (old_source_type = 'arcgis-vector' or old_source_type = 'arcgis-dynamic-mapserver') into old_metadata_is_dynamic from table_of_contents_items where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id limit 1;
        insert into archived_data_sources (
          data_source_id,
          data_layer_id,
          version,
          mapbox_gl_style,
          changelog,
          source_layer,
          bounds,
          sublayer,
          sublayer_type,
          dynamic_metadata,
          project_id
        ) values (
          old_source_id,
          replace_data_source.data_layer_id,
          (
            select 
              coalesce(max(version), 0) + 1 
            from 
              archived_data_sources 
            where archived_data_sources.data_layer_id = replace_data_source.data_layer_id
          ),
          (
            select 
              mapbox_gl_styles
            from 
              data_layers 
            where id = replace_data_source.data_layer_id
          ),
          (select changelog from data_sources where id = replace_data_source.data_source_id),
          (select data_layers.source_layer from data_layers where data_layers.id = replace_data_source.data_layer_id),
          (select table_of_contents_items.bounds from table_of_contents_items where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id and table_of_contents_items.bounds is not null limit 1),
          (select sublayer from data_layers where id = data_layer_id),
          (select sublayer_type from data_layers where id = data_layer_id),
          old_metadata_is_dynamic,
          (select project_id from data_sources where id = replace_data_source.data_source_id)
        );
        update data_layers set data_source_id = replace_data_source.data_source_id, source_layer = replace_data_source.source_layer, mapbox_gl_styles = coalesce(gl_styles, data_layers.mapbox_gl_styles) where id = replace_data_source.data_layer_id;
        update table_of_contents_items set bounds = replace_data_source.bounds where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id;
    end;
  $$;


create or replace function data_layers_version(data_layer data_layers)
  returns int
  language sql
  security definer
  stable
  as $$
    select coalesce(max(version), 0) + 1 from archived_data_sources where data_layer_id = data_layer.id;
    $$;

grant execute on function data_layers_version to anon;

create or replace function data_layers_archived_sources(data_layer data_layers)
  returns setof archived_data_sources
  language sql
  security definer
  stable
  as $$
    select * from archived_data_sources where data_layer_id = data_layer.id order by version desc;
    $$;

grant execute on function data_layers_archived_sources to anon;
comment on function data_layers_archived_sources is '@simpleCollections only';

alter table archived_data_sources add column if not exists bounds numeric[];


CREATE OR REPLACE FUNCTION public.archived_data_sources_sprites(l public.archived_data_sources) RETURNS SETOF public.sprites
    LANGUAGE sql STABLE
    AS $$
  select * from sprites where id in (
      select i::int from (
        select 
          unnest(l.sprite_ids) i 
      ) t)
    ;
$$;

comment on function archived_data_sources_sprites is '@simpleCollections only';

grant execute on function archived_data_sources_sprites to anon;

alter table archived_data_sources add column if not exists created_at timestamp with time zone default now();

alter table data_sources add column if not exists changelog text;
alter table data_upload_tasks add column if not exists changelog text;


drop function if exists set_data_upload_task_changelog;
create or replace function set_data_upload_task_changelog(data_upload_task_id uuid, changelog text)
  returns data_upload_tasks
  language plpgsql
  security definer
  as $$
    declare
      task data_upload_tasks;
    begin
      if (session_is_admin((select project_id from data_sources where id = (select replace_source_id from data_upload_tasks where id = data_upload_task_id)))) then
        -- first, set the changelog on data_upload_task
        update data_upload_tasks set changelog = set_data_upload_task_changelog.changelog where id = data_upload_task_id;
        -- then, see if there are any data_sources that have already been created for the task. If so, set data_source.changelog
        update data_sources set changelog = set_data_upload_task_changelog.changelog where upload_task_id = data_upload_task_id;
        select * into task from data_upload_tasks where id = data_upload_task_id;
        return task;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function set_data_upload_task_changelog to seasketch_user;

create or replace function data_upload_tasks_data_source(data_upload_task data_upload_tasks)
  returns data_sources
  language sql
  security definer
  stable
  as $$
    select * from data_sources where upload_task_id = data_upload_task.id;
    $$;

grant execute on function data_upload_tasks_data_source to seasketch_user;


CREATE OR REPLACE FUNCTION public.projects_uploaded_draft_data_sources(p public.projects) RETURNS SETOF public.data_sources
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select * from data_sources where type = any ('{seasketch-mvt,seasketch-vector,seasketch-raster}') and project_id = p.id;
$$;

create index if not exists archived_data_sources_data_source_id_fkey on archived_data_sources(data_source_id);

create or replace function data_sources_is_archived(data_source data_sources)
  returns boolean
  language sql
  security definer
  stable
  as $$
    select exists(select 1 from archived_data_sources where data_source_id = data_source.id);
    $$;

  grant execute on function data_sources_is_archived to anon;

  create or replace function data_sources_related_table_of_contents_items(data_source data_sources)
  returns setof table_of_contents_items
  language sql
  security definer
  stable
  as $$
    select * from table_of_contents_items where data_layer_id in (select id from data_layers where data_source_id = data_source.id);
    $$;

  grant execute on function data_sources_related_table_of_contents_items to anon;

  comment on function data_sources_related_table_of_contents_items is '@simpleCollections only';


drop function if exists table_of_contents_items_breadcrumbs;
drop type if exists folder_breadcrumbs;
  create type folder_breadcrumbs as (
    id integer,
    stable_id text,
    title text
  );

  create or replace function table_of_contents_items_breadcrumbs(item table_of_contents_items)
    returns setof folder_breadcrumbs
    language sql
    security definer
    stable
    as $$
      with recursive breadcrumbs as (
        select 0 as position, id, title, parent_stable_id, stable_id, is_draft from table_of_contents_items where id = item.id and is_draft = item.is_draft
        union all
        select b.position + 1 as position, t.id, t.title, t.parent_stable_id, t.stable_id, t.is_draft from breadcrumbs b join table_of_contents_items t on b.parent_stable_id = t.stable_id and b.is_draft = t.is_draft
      )
      select id, stable_id, title from breadcrumbs where position > 0 order by position desc;
    $$;


comment on function table_of_contents_items_breadcrumbs is '@simpleCollections only';
  grant execute on function table_of_contents_items_breadcrumbs to anon;

  create index if not exists table_of_contents_items_stable_id_idx on table_of_contents_items(stable_id);

drop function if exists table_of_contents_items_quota_used;
drop function if exists data_sources_quota_used;
drop type if exists quota_details;
create type quota_details as (
  bytes bigint,
  id int,
  type data_upload_output_type,
  is_original boolean,
  is_archived boolean
);

create or replace function data_sources_quota_used(source data_sources)
  returns setof quota_details
  language sql
  security definer
  stable as $$
    select
      size as bytes,
      id,
      type,
      is_original,
      false as is_archived
    from
      data_upload_outputs
    where
      data_source_id = source.id;
  $$;

grant execute on function data_sources_quota_used to seasketch_user;
comment on function data_sources_quota_used is '@simpleCollections only';

create or replace function table_of_contents_items_quota_used(item table_of_contents_items)
  returns setof quota_details
  language sql
  security definer
  stable as $$
    select
      size as bytes,
      id,
      type,
      is_original,
      false as is_archived
    from
      data_upload_outputs
    where
      data_source_id = (
        select data_source_id from data_layers where id = item.data_layer_id
      )
    union all
    select
      size as bytes,
      id,
      type,
      is_original,
      true as is_archived
    from
      data_upload_outputs
    where
      data_source_id in (
        select data_source_id from archived_data_sources where data_layer_id = item.data_layer_id
      )
  $$;

grant execute on function table_of_contents_items_quota_used to seasketch_user;

comment on function table_of_contents_items_quota_used is '@simpleCollections only';

create or replace function data_layers_total_quota_used(layer data_layers)
  returns bigint
  language sql
  security definer
  stable as $$
    select coalesce(sum(size), 0) from data_upload_outputs where data_source_id in (
      select data_source_id from data_layers where id = layer.id
      union all
      select data_source_id from archived_data_sources where data_layer_id = layer.id
    )
  $$;

grant execute on function data_layers_total_quota_used to seasketch_user;

create or replace function delete_archived_source(source_id int)
  returns table_of_contents_items
  language plpgsql
  security definer
  as $$
    declare
      pid int;
      source archived_data_sources;
      item_id integer;
      item table_of_contents_items;
      archive archived_data_sources;
    begin
      select
        project_id into pid 
      from 
        data_sources 
      where 
        id = delete_archived_source.source_id;
      
      if session_is_admin(pid) then
        select * into archive from archived_data_sources where data_source_id = delete_archived_source.source_id;
        if archive is null then
          raise exception 'Archived source not found';
        end if;
        select 
          id into item_id 
        from 
          table_of_contents_items 
        where 
          data_layer_id = archive.data_layer_id;
        delete from archived_data_sources where data_source_id = delete_archived_source.source_id;
        select * from table_of_contents_items where id = item_id into item;
        return item;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function delete_archived_source to seasketch_user;

create or replace function rollback_to_archived_source(source_id integer, rollback_gl_style boolean)
  returns table_of_contents_items
  language plpgsql
  security definer
  as $$
    declare
      pid int;
      source archived_data_sources;
      item_id integer;
      item table_of_contents_items;
      archive archived_data_sources;
      source_type text;
    begin
      select
        project_id, 
        type 
      into 
        pid, 
        source_type
      from 
        data_sources 
      where 
        id = rollback_to_archived_source.source_id;
      
      if session_is_admin(pid) then
        select * into archive from archived_data_sources where data_source_id = rollback_to_archived_source.source_id;
        if archive is null then
          raise exception 'Archived source not found';
        end if;
        select 
          id into item_id 
        from 
          table_of_contents_items 
        where 
          table_of_contents_items.data_layer_id = archive.data_layer_id;
        update 
          data_layers 
        set 
          data_source_id = rollback_to_archived_source.source_id, 
          source_layer = archive.source_layer,
          mapbox_gl_styles = (
            case source_type
              when 'arcgis-dynamic-mapserver' then
                null
              when 'arcgis-vector' then
                null
              when 'arcgis-dynamic-mapserver-vector-sublayer' then
                null
              else
                case when rollback_gl_style then
                  archive.mapbox_gl_style
                else
                  data_layers.mapbox_gl_styles
                end
              end
          )
        where 
          id = archive.data_layer_id;
        update table_of_contents_items set bounds = archive.bounds where table_of_contents_items.data_layer_id = archive.data_layer_id;
        delete from archived_data_sources where data_source_id = rollback_to_archived_source.source_id;
        delete from archived_data_sources where archived_data_sources.data_layer_id = archive.data_layer_id and version >= archive.version;
        if archive.sublayer is not null then
          update data_layers set sublayer = archive.sublayer, sublayer_type = archive.sublayer_type where id = archive.data_layer_id;
        end if;
        if archive.dynamic_metadata then
          update table_of_contents_items set metadata = null where table_of_contents_items.data_layer_id = archive.data_layer_id and is_draft = true;
        end if;
        delete from esri_feature_layer_conversion_tasks where table_of_contents_item_id = item_id;
        select * from table_of_contents_items where id = item_id into item;
        return item;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function rollback_to_archived_source to seasketch_user;

alter table archived_data_sources add column if not exists sublayer text;
alter table archived_data_sources add column if not exists sublayer_type sublayer_type;

alter table archived_data_sources alter mapbox_gl_style drop not null;

alter table archived_data_sources add column if not exists dynamic_metadata boolean not null default false;


alter table projects add column if not exists data_hosting_retention_period interval;

grant update(data_hosting_retention_period) on projects to seasketch_user;

drop function if exists estimate_deleted_data_for_retention_change;
drop function if exists projects_estimate_deleted_data_for_retention_change;
drop type if exists retention_change_estimate;

create type retention_change_estimate as (
  bytes bigint,
  num_sources int
);

create or replace function projects_estimate_deleted_data_for_retention_change(project projects, new_retention_period interval)
  returns retention_change_estimate
  language plpgsql
  security definer
  stable
  as $$
    declare
      bytes bigint;
      num_sources int;
      estimate retention_change_estimate :=  (0, 0);
    begin
      if session_is_admin(project.id) then
        select 
          count(distinct(data_source_id)),
          sum(size) into estimate.num_sources, estimate.bytes
        from 
          data_upload_outputs 
        where 
          data_source_id in (
            select 
              data_source_id 
            from 
              archived_data_sources 
            where 
              project_id = project.id and
              created_at < now() - new_retention_period
            );
        return estimate;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function projects_estimate_deleted_data_for_retention_change to seasketch_user;

create or replace function delete_expired_archived_data_sources()
  returns void
  language sql
  security definer
  as $$
    delete from
      archived_data_sources
    where
      archived_data_sources.project_id not in (
        select id from projects where data_hosting_retention_period is null
      ) and
      created_at < now() - (select data_hosting_retention_period from projects where id = archived_data_sources.project_id);
  $$;
