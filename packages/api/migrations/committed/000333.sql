--! Previous: sha1:e3935e877da2127dff11eddedc2757bac22d6d79
--! Hash: sha1:4ea962dffa449fff61823af90b43bbd2540b49ca

-- Enter migration here
alter table data_upload_tasks add column if not exists replace_table_of_contents_item_id integer references table_of_contents_items(id) on delete cascade;
alter table data_upload_tasks drop column if exists replace_source_id;

drop function if exists create_data_upload;
CREATE OR REPLACE FUNCTION public.create_data_upload(filename text, project_id integer, content_type text, replace_table_of_contents_item_id integer) RETURNS public.data_upload_tasks
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
        if replace_table_of_contents_item_id is not null and (select exists(
          select 
            data_upload_tasks.id 
          from 
            data_upload_tasks 
          inner join 
            project_background_jobs 
          on 
            data_upload_tasks.project_background_job_id = project_background_jobs.id 
          where 
            data_upload_tasks.replace_table_of_contents_item_id is not null and 
            project_background_jobs.state in ('queued', 'running') and
            data_upload_tasks.replace_table_of_contents_item_id = create_data_upload.replace_table_of_contents_item_id
        )) then
          raise exception 'There is already an active upload task for this layer';
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
              case when replace_table_of_contents_item_id is not null then 'Replacement upload ' else '' end
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
            replace_table_of_contents_item_id
          ) values (
            create_data_upload.filename, 
            create_data_upload.content_type, 
            job.id,
            create_data_upload.replace_table_of_contents_item_id
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

CREATE OR REPLACE FUNCTION public.replace_data_source(data_layer_id integer, data_source_id integer, source_layer text, bounds numeric[], gl_styles jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
        update data_layers set data_source_id = replace_data_source.data_source_id, source_layer = replace_data_source.source_layer, mapbox_gl_styles = coalesce(gl_styles, data_layers.mapbox_gl_styles), sublayer = null where id = replace_data_source.data_layer_id;
        update table_of_contents_items set bounds = replace_data_source.bounds where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id;
    end;
  $$;

CREATE OR REPLACE FUNCTION public.set_data_upload_task_changelog(data_upload_task_id uuid, changelog text) RETURNS public.data_upload_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      task data_upload_tasks;
    begin
      if (session_is_admin((select project_id from table_of_contents_items where id = (select replace_table_of_contents_item_id from data_upload_tasks where id = data_upload_task_id)))) then
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

CREATE OR REPLACE FUNCTION public.rollback_to_archived_source(source_id integer, rollback_gl_style boolean) RETURNS public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
          ),
          sublayer = archive.sublayer
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
