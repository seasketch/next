-- Enter migration here
alter table table_of_contents_items add column if not exists data_library_template_id text unique;

alter table table_of_contents_items add column if not exists copied_from_data_library_template_id text;

comment on column table_of_contents_items.data_library_template_id is '@omit';

create or replace function copy_table_of_contents_item(item_id int, copy_data_source boolean, append_copy_to_name boolean, "projectId" int, lpath ltree, "parentStableId" text)
  returns integer
  language plpgsql
  security definer
  as $$
    declare 
      copy_id int;
      child record;
      data_layer_copy_id int;
      original_data_source_id int;
      original_data_layer_id int;
      ds_id int;
      interactivity_id int;
      new_stable_id text;
      new_lpath ltree;
      isfolder boolean;
    begin
      select 
        data_layer_id, 
        is_folder 
      into 
        original_data_layer_id, 
        isfolder 
      from 
        table_of_contents_items 
      where 
        id = item_id;
      if isfolder = false and original_data_layer_id is null then
        raise exception 'original_data_layer_id is null';
      end if;
      select 
        data_source_id 
      into 
        original_data_source_id 
      from 
        data_layers 
      where 
        id = original_data_layer_id;
      if isfolder = false and original_data_source_id is null then
        raise exception 'original_data_source_id is null. original_data_layer=%', original_data_layer_id;
      end if;
      -- copy data source, if necessary
      if isfolder = false and copy_data_source then
        insert into data_sources (
          project_id,
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          bucket_id,
          object_key,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id,
          translated_props,
          arcgis_fetch_strategy,
          uploaded_by,
          was_converted_from_esri_feature_layer,
          created_by,
          changelog
        ) select
          "projectId",
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          bucket_id,
          object_key,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id,
          translated_props,
          arcgis_fetch_strategy,
          uploaded_by,
          was_converted_from_esri_feature_layer,
          created_by,
          changelog
        from 
          data_sources
        where 
          id = original_data_source_id 
        returning 
          id 
        into 
          ds_id;     
        if ds_id is null then
          raise exception 'Failed to copy data source. original_data_source_id=%', original_data_source_id;
        end if;   
        -- copy data_upload_outputs
        insert into data_upload_outputs (
          data_source_id,
          project_id,
          type,
          created_at,
          url,
          remote,
          is_original,
          size,
          filename,
          original_filename
        ) select 
            ds_id,
            "projectId",
            type,
            created_at,
            url,
            remote,
            is_original,
            size,
            filename,
            original_filename
          from 
            data_upload_outputs 
          where 
            data_source_id = original_data_source_id;
      else
        ds_id := original_data_source_id;
      end if;
      if isfolder = false then
        -- copy interactivity settings
        insert into interactivity_settings (
          type,
          short_template,
          long_template,
          cursor,
          layers,
          title
        ) select
          type,
          short_template,
          long_template,
          cursor,
          layers,
          title
        from interactivity_settings where id = (select interactivity_settings_id from data_layers where id = (select data_layer_id from table_of_contents_items where id = item_id)) returning id into interactivity_id;
        -- copy data layer

        insert into data_layers (
          project_id,
          data_source_id,
          source_layer,
          sublayer,
          render_under,
          mapbox_gl_styles,
          z_index,
          interactivity_settings_id,
          static_id,
          sublayer_type
        ) select
          "projectId",
          ds_id,
          source_layer,
          sublayer,
          render_under,
          mapbox_gl_styles,
          z_index,
          interactivity_id,
          static_id,
          sublayer_type
        from data_layers where id = original_data_layer_id
        returning id into data_layer_copy_id;
      end if;
      -- copy toc item
      new_stable_id := create_stable_id();
      -- create new lpath by appending new_stable_id to lpath using ltree api
      new_lpath := lpath || new_stable_id;
      insert into table_of_contents_items (
        path,
        project_id,
        stable_id,
        parent_stable_id,
        title,
        is_folder,
        show_radio_children,
        is_click_off_only,
        metadata,
        bounds,
        data_layer_id,
        sort_index,
        hide_children,
        enable_download,
        translated_props,
        data_source_type,
        original_source_upload_available,
        copied_from_data_library_template_id
      ) select
        new_lpath,
        "projectId",
        new_stable_id,
        "parentStableId",
        (
          case 
            when append_copy_to_name then title || ' (copy)'
            else title
          end
        ),
        is_folder,
        show_radio_children,
        is_click_off_only,
        metadata,
        bounds,
        data_layer_copy_id,
        sort_index,
        hide_children,
        enable_download,
        translated_props,
        data_source_type,
        original_source_upload_available,
        data_library_template_id
      from table_of_contents_items where id = item_id returning id into copy_id;
      return copy_id;
    end;
  $$;

create or replace function copy_table_of_contents_item_recursive(item_id int, copy_data_source boolean, append_copy_to_name boolean, project_id int, lpath ltree, parent_stable_id text)
  returns integer
  language plpgsql
  security definer
  as $$
    declare 
      copy_id int;
      child record;
      new_stable_id text;
      old_stable_id text;
    begin
      select stable_id into old_stable_id from table_of_contents_items where id = item_id;
      copy_id := copy_table_of_contents_item(item_id, copy_data_source, append_copy_to_name, project_id, lpath, parent_stable_id);
      select stable_id into new_stable_id from table_of_contents_items where id = copy_id; 
      for child in select * from table_of_contents_items where table_of_contents_items.parent_stable_id = old_stable_id and is_draft = true loop
        perform copy_table_of_contents_item_recursive(
          child.id, 
          copy_data_source, 
          false, 
          project_id, 
          lpath || new_stable_id, 
          new_stable_id
        );
      end loop;
      return copy_id;
    end;
  $$;


CREATE OR REPLACE FUNCTION check_toc_item_rls_policy(id int)
  returns boolean
  language plpgsql
  security invoker
  as $$
  BEGIN
    -- Try to select the resource under current user privileges
    PERFORM 1 FROM table_of_contents_items WHERE table_of_contents_items.id = check_toc_item_rls_policy.id;
    RETURN TRUE; -- Resource is accessible
    EXCEPTION
        WHEN insufficient_privilege THEN
            RETURN FALSE; -- Resource is not accessible due to RLS
  END;
$$;

create or replace function duplicate_table_of_contents_item(item_id int)
  returns table_of_contents_items
  language plpgsql
  security definer
  as $$
    declare 
      copy_id int;
      pid int;
      lpath ltree;
      parent_stableid text;
      r record;
      policy_passed boolean;
    begin
      policy_passed := check_sketch_rls_policy(item_id);
      if policy_passed = false then
        raise exception 'Permission denied';
      end if;
      select
        project_id,
        path,
        parent_stable_id
      into 
        pid,
        lpath,
        parent_stableid
      from
        table_of_contents_items
      where
        id = item_id;
      -- pop one level off the path
      lpath := subpath(lpath, 0, nlevel(lpath) - 1);
      copy_id := copy_table_of_contents_item_recursive(item_id, true, true, pid, lpath, parent_stableid);
      select * into r from table_of_contents_items where id = copy_id;
      return r;
    end;
  $$;

grant execute on function duplicate_table_of_contents_item to seasketch_user;

drop function if exists copy_data_library_template_item(text, int);
create or replace function copy_data_library_template_item(template_id text, project_slug text)
  returns table_of_contents_items 
  security definer
  language plpgsql
  as $$
    declare
      pid int;
      item_id int;
      copy_id int;
      r record;
    begin
      select id into pid from projects where slug = project_slug;
      select id into item_id from table_of_contents_items where data_library_template_id = template_id and is_draft = true and data_library_template_id is not null;
      if item_id is null then
        raise exception 'Template not found';
      end if;
      if session_is_admin(pid) then
        copy_id := copy_table_of_contents_item_recursive(item_id, false, false, pid, ''::ltree, null);
        select * into r from table_of_contents_items where id = copy_id;
        return r;
      else
        raise exception 'You do not have permission to copy this item';
      end if;
    end;
  $$;

grant execute on function copy_data_library_template_item(text, text) to seasketch_user;

insert into users (
  sub,
  canonical_email
) values (
  'data-library-template-updater',
  'datalibrary@seasketch.org'
) on conflict do nothing;



CREATE FUNCTION public.replace_data_source(data_layer_id integer, data_source_id integer, source_layer text, bounds numeric[], gl_styles jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      old_source_id integer;
      old_source_type text;
      old_metadata_is_dynamic boolean;
      dl_template_id text;
    begin
        -- first, determine if a related table_of_contents_item has
        -- data_library_template_id set. If so, we need to update the
        -- related Toc items that have copied_from_data_library_template_id
        -- matching.

        select data_library_template_id into dl_template_id from table_of_contents_items where data_layer_id = replace_data_source.data_layer_id and data_library_template_id is not null limit 1;

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
        
        update 
          data_layers 
        set 
          data_source_id = replace_data_source.data_source_id, 
          source_layer = replace_data_source.source_layer, 
          mapbox_gl_styles = coalesce(
            gl_styles, data_layers.mapbox_gl_styles
          ), 
          sublayer = null 
        where 
          -- TODO: update related copies of template
          id = replace_data_source.data_layer_id or (
            case 
              when dl_template_id is not null then copied_from_data_library_template_id = dl_template_id
              else false
            end
          )

        update 
          table_of_contents_items 
        set bounds = replace_data_source.bounds 
        where 
          table_of_contents_items.data_layer_id = replace_data_source.data_layer_id;
    end;
  $$;
