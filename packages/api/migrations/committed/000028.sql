--! Previous: sha1:a7c4b8dffe23ed1b025b62dfdf35b63c7191bf56
--! Hash: sha1:12c8706b5c07264e77a5dbf2cda1735de89d2687

-- Enter migration here
alter table data_layers add column if not exists z_index int not null default 0;

grant select(z_index) on data_layers to anon;
grant update(z_index) on data_layers to seasketch_user;

alter table data_sources add column if not exists supports_dynamic_layers boolean not null default true;
comment on column data_sources.supports_dynamic_layers is 'ArcGIS map service setting. If enabled, client can reorder layers and apply layer-specific opacity settings.';

grant select(supports_dynamic_layers) on data_sources to anon;
grant update(supports_dynamic_layers) on data_sources to seasketch_user;
grant insert(supports_dynamic_layers) on data_sources to seasketch_user;

CREATE or replace FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
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
    begin
      -- check permissions
      if session_is_admin("projectId") = false then
        raise 'Permission denied. Must be a project admin';
      end if;
      -- delete existing published table of contents items, layers, sources, and interactivity settings
      delete from 
        interactivity_settings 
      where
        data_source_id in (
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

      delete from data_sources where id in (
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
          insert into data_layers (
            project_id,
            data_source_id,
            source_layer,
            sublayer,
            render_under,
            mapbox_gl_styles,
            z_index
          )
            select "projectId", 
              data_source_id, 
              source_layer, 
              sublayer, 
              render_under, 
              mapbox_gl_styles,
              z_index
            from data_layers
            where id = item.data_layer_id
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
          data_layer_id
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
          lid
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
          supports_dynamic_layers
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
          supports_dynamic_layers
          from 
            data_sources 
          where
            id = source_id
          returning id into copied_source_id;
        -- copy any interactivity settings
        insert into interactivity_settings (
          data_source_id,
          source_layer,
          type,
          short_template,
          long_template,
          cursor
        ) select
          copied_source_id,
          source_layer,
          type,
          short_template,
          long_template,
          cursor
        from
          interactivity_settings
        where
          data_source_id = source_id;
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


CREATE OR REPLACE FUNCTION public.before_insert_or_update_data_layers_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  declare
    source_type text;
    max_z int;
  begin
    select type into source_type from data_sources where id = new.data_source_id;
    if source_type is null then
      raise 'Unknown source type. %', (new.data_source_id);
    end if;
    if new.sublayer is not null and source_type != 'arcgis-dynamic-mapserver' then
      raise 'sublayer property can only be specified for layers associated with a arcgis-dynamic-mapserver source';
    end if;
    if source_type = 'vector' then
      if new.source_layer is null then
        raise 'Layers with "vector" data sources must specify a source_layer';
      end if;
    else
      if new.source_layer is not null then
        raise 'Only Layers with data_sources of type "vector" should specify a source_layer';
      end if;
    end if;
    if (source_type = 'vector' or source_type = 'geojson' or source_type = 'seasketch-vector') then
      if new.mapbox_gl_styles is null then
        raise 'Vector layers must specify mapbox_gl_styles';
      end if;
    else
      if new.mapbox_gl_styles is not null then
        raise 'Layers with data_sources of type % should not specify mapbox_gl_styles', (source_type);
      end if;
    end if;
    if old is null then
      -- assign a z-index
      select max(z_index) + 1 into max_z from data_layers where project_id = new.project_id;
      if max_z is null then
        max_z = 0;
      end if;
      new.z_index = max_z;
    end if;
    return new;
  end;
$$;

create or replace function update_z_indexes("dataLayerIds" int[]) returns setof data_layers
  language plpgsql
  volatile
  security definer
  as $$
  declare
    z int;
    pid int;
  begin
    if (select count(distinct(project_id)) from data_layers where id = any("dataLayerIds")) > 1 then
      raise 'Denied. Attempting to modify more than one project.';
    end if;
    if (session_is_admin((select project_id from data_layers where id = any("dataLayerIds") limit 1))) != true then
      raise 'Unauthorized';
    end if;
    z = 0;
    for i in array_lower("dataLayerIds", 1)..array_upper("dataLayerIds", 1) loop
      z = z + 1;
      update data_layers set z_index = z where id = "dataLayerIds"[i];
    end loop;
    return query (select * from data_layers where id = any("dataLayerIds"));
  end
$$;

grant execute on function update_z_indexes to seasketch_user;
