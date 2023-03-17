-- Enter migration here
alter table table_of_contents_items add column if not exists geoprocessing_reference_id text;

-- select 
--   table_of_contents_items.stable_id, 
--   data_layers.static_id 
-- from 
--   table_of_contents_items 
-- inner join data_layers 
-- on
--   table_of_contents_items.data_layer_id = data_layers.id
-- where
--   table_of_contents_items.data_layer_id is not null and data_layers.static_id is not null;


CREATE or replace FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    -- if old.is_folder != new.is_folder then
    --   raise 'Cannot change is_folder. Create a new table of contents item';
    -- end if;
    -- if old.is_draft = false then
    --   raise 'Cannot alter table of contents items after they are published';
    -- end if;
    -- if new.sort_index is null then
    --   new.sort_index = (select coalesce(max(sort_index), -1) + 1 from table_of_contents_items where is_draft = true and project_id = new.project_id and parent_stable_id = new.parent_stable_id or (parent_stable_id is null and new.parent_stable_id is null));
    -- end if;
    -- if old is null and new.is_draft = true then -- inserting
    --   -- verify that stable_id is unique among draft items
    --   if (select count(id) from table_of_contents_items where stable_id = new.stable_id and is_draft = true) > 0 then
    --     raise '% is not a unique stable_id.', new.stable_id;
    --   end if;
    --   -- set path
    --   if new.parent_stable_id is null then
    --     new.path = new.stable_id;
    --   else
    --     if (select count(id) from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) > 0 then
    --       -- set path, finding path of parent and appending to it
    --       new.path = (select path from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) || new.stable_id;
    --     else
    --       raise 'Cannot find parent item with stable_id=%', new.parent_stable_id;
    --     end if;
    --   end if;
    -- end if;
    -- if new.is_folder then
    --   if new.data_layer_id is not null then
    --     raise 'Folders cannot have data_layer_id set';
    --   end if;
    --   if new.metadata is not null then
    --     raise 'Folders cannot have metadata set';
    --   end if;
    --   if new.bounds is not null then
    --     raise 'Folders cannot have bounds set';
    --   end if;
    -- else
    --   if new.data_layer_id is null then
    --     raise 'data_layer_id must be set if is_folder=false';
    --   end if;
    --   if new.show_radio_children then
    --     raise 'show_radio_children must be false if is_folder=false';
    --   end if;
    --   if new.is_click_off_only then
    --     raise 'is_click_off_only must be false if is_folder=false';
    --   end if;
    -- end if;
    return new;
  end;
$$;

update table_of_contents_items set geoprocessing_reference_id = (select static_id from data_layers where data_layers.id = table_of_contents_items.id);

CREATE or replace FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    if old.is_folder != new.is_folder then
      raise 'Cannot change is_folder. Create a new table of contents item';
    end if;
    if old.is_draft = false then
      raise 'Cannot alter table of contents items after they are published';
    end if;
    if new.sort_index is null then
      new.sort_index = (select coalesce(max(sort_index), -1) + 1 from table_of_contents_items where is_draft = true and project_id = new.project_id and parent_stable_id = new.parent_stable_id or (parent_stable_id is null and new.parent_stable_id is null));
    end if;
    if old is null and new.is_draft = true then -- inserting
      -- verify that stable_id is unique among draft items
      if (select count(id) from table_of_contents_items where stable_id = new.stable_id and is_draft = true) > 0 then
        raise '% is not a unique stable_id.', new.stable_id;
      end if;
      -- set path
      if new.parent_stable_id is null then
        new.path = new.stable_id;
      else
        if (select count(id) from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) > 0 then
          -- set path, finding path of parent and appending to it
          new.path = (select path from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) || new.stable_id;
        else
          raise 'Cannot find parent item with stable_id=%', new.parent_stable_id;
        end if;
      end if;
    end if;
    if new.is_folder then
      if new.data_layer_id is not null then
        raise 'Folders cannot have data_layer_id set';
      end if;
      if new.metadata is not null then
        raise 'Folders cannot have metadata set';
      end if;
      if new.bounds is not null then
        raise 'Folders cannot have bounds set';
      end if;
    else
      if new.data_layer_id is null then
        raise 'data_layer_id must be set if is_folder=false';
      end if;
      if new.show_radio_children then
        raise 'show_radio_children must be false if is_folder=false';
      end if;
      if new.is_click_off_only then
        raise 'is_click_off_only must be false if is_folder=false';
      end if;
    end if;
    return new;
  end;
$$;


CREATE OR REPLACE FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      lid int;
      item table_of_contents_items;
      source_id int;
      copied_source_id int;
      acl_type access_control_list_type;
      acl_id int;
      orig_acl_id int;
      new_toc_id int;
      new_interactivity_settings_id int;
    begin
      -- check permissions
      if session_is_admin("projectId") = false then
        raise 'Permission denied. Must be a project admin';
      end if;
      -- delete existing published table of contents items, layers, sources, and interactivity settings
      delete from 
        interactivity_settings 
      where
        id in (
          select 
            data_layers.interactivity_settings_id
          from
            data_layers
          inner JOIN
            table_of_contents_items
          on
            data_layers.id = table_of_contents_items.data_layer_id
          where
            table_of_contents_items.project_id = "projectId" and
            is_draft = false
        );

      delete from data_sources where data_sources.id in (
        select 
          data_source_id 
        from
          data_layers
        inner JOIN
          table_of_contents_items
        on
          data_layers.id = table_of_contents_items.data_layer_id
        where
          table_of_contents_items.project_id = "projectId" and
          is_draft = false
      );
      delete from data_layers where id in (
        select 
          data_layer_id 
        from 
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = false
      );
      delete from 
        table_of_contents_items 
      where 
        project_id = "projectId" and 
        is_draft = false;

      -- one-by-one, copy related layers and link table of contents items
      for item in 
        select 
          * 
        from 
          table_of_contents_items 
        where 
          is_draft = true and 
          project_id = "projectId"
      loop
        if item.is_folder = false then
          -- copy interactivity settings first
          insert into interactivity_settings (
            type,
            short_template,
            long_template,
            cursor
          ) select
              type,
              short_template,
              long_template,
              cursor
            from
              interactivity_settings
            where
              interactivity_settings.id = (
                select interactivity_settings_id from data_layers where data_layers.id = item.data_layer_id
              )
            returning
              id
            into
              new_interactivity_settings_id;

          insert into data_layers (
            project_id,
            data_source_id,
            source_layer,
            sublayer,
            render_under,
            mapbox_gl_styles,
            interactivity_settings_id
          )
          select "projectId", 
            data_source_id, 
            source_layer, 
            sublayer, 
            render_under, 
            mapbox_gl_styles,
            new_interactivity_settings_id
          from 
            data_layers
          where 
            id = item.data_layer_id
          returning id into lid;
        else
          lid = item.data_layer_id;
        end if;
        -- TODO: this will have to be modified with the addition of any columns
        insert into table_of_contents_items (
          is_draft,
          project_id,
          path,
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
          geoprocessing_reference_id
        ) values (
          false,
          "projectId",
          item.path,
          item.stable_id,
          item.parent_stable_id,
          item.title,
          item.is_folder,
          item.show_radio_children,
          item.is_click_off_only,
          item.metadata,
          item.bounds,
          lid,
          item.sort_index,
          item.hide_children,
          item.geoprocessing_reference_id
        ) returning id into new_toc_id;
        select 
          type, id into acl_type, orig_acl_id 
        from 
          access_control_lists 
        where 
          table_of_contents_item_id = (
            select 
              id 
            from 
              table_of_contents_items 
            where is_draft = true and stable_id = item.stable_id
          );
        -- copy access control list settings
        if acl_type != 'public' then
          update 
            access_control_lists 
          set type = acl_type 
          where table_of_contents_item_id = new_toc_id 
          returning id into acl_id;
          if acl_type = 'group' then
            insert into 
              access_control_list_groups (
                access_control_list_id, 
                group_id
              ) 
            select 
              acl_id, 
              group_id 
            from 
              access_control_list_groups 
            where 
              access_control_list_id = orig_acl_id;
          end if;
        end if;
      end loop;
      -- one-by-one, copy related sources and update foreign keys of layers
      for source_id in
        select distinct(data_source_id) from data_layers where id in (
          select 
            data_layer_id 
          from 
            table_of_contents_items 
          where 
            is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
        )
      loop
        -- TODO: This function will have to be updated whenever the schema 
        -- changes since these columns are hard coded... no way around it.
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
          upload_task_id
        )
          select 
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
          upload_task_id
          from 
            data_sources 
          where
            id = source_id
          returning id into copied_source_id;
        -- update data_layers that should now reference the copy
        update 
          data_layers 
        set data_source_id = copied_source_id 
        where 
          data_source_id = source_id and
          data_layers.id in ((
            select distinct(data_layer_id) from table_of_contents_items where is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
          ));
      end loop;
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;

comment on column data_layers.static_id is '@deprecated Use TableOfContentsItem.geoprocessingReferenceId instead';

grant update(geoprocessing_reference_id) on table_of_contents_items to seasketch_user;
grant select(geoprocessing_reference_id) on table_of_contents_items to anon;

alter table map_bookmarks add column if not exists basemap_name text;

alter table map_bookmarks add column if not exists layer_names jsonb;

drop function if exists create_map_bookmark(slug text, "isPublic" boolean, style jsonb, "visibleDataLayers" text[], "selectedBasemap" integer, "basemapOptionalLayerStates" jsonb, "cameraOptions" jsonb, "mapDimensions" integer[], "visibleSketches" integer[], "sidebarState" jsonb);
CREATE OR REPLACE FUNCTION public.create_map_bookmark(slug text, "isPublic" boolean, style jsonb, "visibleDataLayers" text[], "selectedBasemap" integer, "basemapOptionalLayerStates" jsonb, "cameraOptions" jsonb, "mapDimensions" integer[], "visibleSketches" integer[], "sidebarState" jsonb, "basemapName" text, "layerNames" jsonb) RETURNS public.map_bookmarks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      bookmark map_bookmarks;
      pid int;
    begin
      select id into pid from projects where projects.slug = create_map_bookmark.slug;
      if session_has_project_access(pid) then
        insert into map_bookmarks (
          project_id, 
          user_id, 
          is_public, 
          style, 
          visible_data_layers, 
          selected_basemap, 
          basemap_optional_layer_states, 
          camera_options,
          map_dimensions,
          visible_sketches,
          sidebar_state,
          basemap_name,
          layer_names
        ) values (
          pid,
          nullif(current_setting('session.user_id', TRUE), '')::int,
          "isPublic",
          create_map_bookmark.style,
          "visibleDataLayers",
          "selectedBasemap",
          "basemapOptionalLayerStates",
          "cameraOptions",
          "mapDimensions",
          "visibleSketches",
          "sidebarState",
          "basemapName",
          "layerNames"
        ) returning * into bookmark;
        return bookmark;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function create_map_bookmark to seasketch_user;