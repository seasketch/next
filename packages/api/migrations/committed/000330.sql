--! Previous: sha1:70af5c278ab4307d6445e6dcce482838d3d4ef96
--! Hash: sha1:f0e164d25df9fdd663014da142e4e6e1de5e9c7d

-- Enter migration here
alter table data_sources add column if not exists created_by integer references users(id);

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
            cursor,
            title
          ) select
              type,
              short_template,
              long_template,
              cursor,
              title
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
            sublayer_type,
            render_under,
            mapbox_gl_styles,
            interactivity_settings_id,
            z_index
          )
          select "projectId", 
            data_source_id, 
            source_layer, 
            sublayer, 
            sublayer_type,
            render_under, 
            mapbox_gl_styles,
            new_interactivity_settings_id,
            z_index
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
          geoprocessing_reference_id,
          translated_props,
          enable_download
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
          item.geoprocessing_reference_id,
          item.translated_props,
          item.enable_download
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
          created_by
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
          created_by
          from 
            data_sources 
          where
            id = source_id
          returning id into copied_source_id;
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
            copied_source_id,
            project_id,
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
      update 
        projects 
      set 
        draft_table_of_contents_has_changes = false, 
        table_of_contents_last_published = now() 
      where 
        id = "projectId";
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;

create or replace function current_user_id() 
  returns integer
  language sql
  as $$
    select nullif(current_setting('session.user_id', TRUE), '')::int;
  $$;

CREATE or replace FUNCTION public.create_remote_geojson_source(slug text, url text, geostats jsonb, bounds numeric[]) RETURNS public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      stableid text := create_stable_id();
      pid int;
      item table_of_contents_items;
      layer_id int;
      source_id int;
      geostats_layer jsonb;
    begin
      select id into pid from projects where projects.slug = create_remote_geojson_source.slug;
      geostats_layer := geostats->'layers'->0;
      if session_is_admin(pid) then
        insert into data_sources (
          project_id,
          type,
          url,
          geostats,
          created_by
        ) values (
          pid,
          'geojson',
          create_remote_geojson_source.url,
          create_remote_geojson_source.geostats,
          current_user_id()
        ) returning id into source_id;
        insert into data_layers (
          project_id,
          data_source_id,
          mapbox_gl_styles
        ) values (
          pid,
          source_id,
          basic_mapbox_gl_style_for_type(geostats_layer->>'geometry')
        ) returning id into layer_id;
        insert into table_of_contents_items (
          project_id,
          title,
          data_layer_id,
          stable_id,
          is_draft,
          metadata,
          is_folder,
          bounds
        ) values (
          pid,
          geostats_layer->>'layer',
          layer_id,
          stableid,
          true,
          make_url_source_metadata(geostats_layer->>'layer', url),
          false,
          create_remote_geojson_source.bounds
        ) returning * into item;
        return item;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

CREATE or replace FUNCTION public.create_remote_mvt_source(project_id integer, url text, source_layers text[], max_zoom integer, min_zoom integer, bounds numeric[], geostats jsonb, feature_bounds numeric[]) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    source_id int;
    layer_id int;
    item table_of_contents_items;
    stableid text;
    i int;
    source_layer text;
    geostats_layer jsonb;
    table_of_contents_item_ids int[];
  begin
    if session_is_admin(project_id) then
      insert into data_sources (
        project_id,
        type,
        tiles,
        minzoom,
        maxzoom,
        geostats,
        bounds,
        created_by
      ) values (
        create_remote_mvt_source.project_id,
        'vector',
        array[url],
        min_zoom,
        max_zoom,
        create_remote_mvt_source.geostats,
        create_remote_mvt_source.bounds,
        current_user_id()
      ) returning id into source_id;
      for i in array_lower(source_layers, 1)..array_upper(source_layers, 1) loop
        source_layer := source_layers[i];
        for l in 0..jsonb_array_length(geostats->'layers') loop
          if (((geostats->'layers')->>l)::jsonb)->>'layer' = source_layer then
            geostats_layer := ((geostats->'layers')->>l)::jsonb;
          end if;
        end loop;
        insert into data_layers (
          project_id,
          data_source_id,
          source_layer,
          mapbox_gl_styles
        ) values (
          create_remote_mvt_source.project_id,
          source_id,
          create_remote_mvt_source.source_layers[i],
          basic_mapbox_gl_style_for_type(geostats_layer->>'geometry')
        ) returning id into layer_id;
        stableid := create_stable_id();
        insert into table_of_contents_items (
          project_id,
          title,
          data_layer_id,
          is_folder,
          enable_download,
          stable_id,
          path,
          bounds
        ) values (
          create_remote_mvt_source.project_id,
          create_remote_mvt_source.source_layers[i],
          layer_id,
          false,
          false,
          stableid,
          stableid::ltree,
          coalesce(feature_bounds, bounds)
        ) returning id into item;
        table_of_contents_item_ids := array_append(table_of_contents_item_ids, item.id);
      end loop;
      return query select * from table_of_contents_items where id = any(table_of_contents_item_ids);
    else
      raise exception 'Permission denied.';
    end if;
  end;
  $$;

CREATE or replace FUNCTION public.import_arcgis_services("projectId" integer, items public.arcgis_import_item[], sources public.arcgis_import_source[]) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare 
      folder_id int;
      source arcgis_import_source;
      source_id int;
      layer_id int;
      item_id int;
      source_id_map jsonb;
      layer_id_map jsonb;
      item_id_map jsonb;
      interactive_layers int[];
    begin
      source_id_map = '{}'::jsonb;
      layer_id_map = '{}'::jsonb;
      item_id_map = '{}'::jsonb;
      if session_is_admin("projectId") then
        for i in array_lower(sources, 1)..array_upper(sources, 1) loop
          source = sources[i];
          if source.type = 'arcgis-vector' then
            insert into data_sources (
              project_id, 
              type,
              url,
              arcgis_fetch_strategy,
              created_by
            ) values (
              "projectId", 
              'arcgis-vector', 
              source.url, 
              source.fetch_strategy,
              current_user_id()
            ) returning id into source_id;
            select 
              id_lookup_set_key(source_id_map, source.id, source_id) 
            into source_id_map;

            insert into data_layers (
              project_id,
              data_source_id
            ) values (
              "projectId",
              source_id
            ) returning id into layer_id;
            select 
              id_lookup_set_key(layer_id_map, source.id, layer_id) 
            into layer_id_map;
            interactive_layers = array_append(interactive_layers, layer_id);
          elsif source.type = 'arcgis-raster-tiles' then
            insert into data_sources (
              project_id, 
              type,
              url,
              use_device_pixel_ratio,
              created_by
            ) values (
              "projectId", 
              'arcgis-raster-tiles', 
              source.url,
              true,
              current_user_id()
            ) returning id into source_id;
            insert into data_layers (
              project_id,
              data_source_id
            ) values (
              "projectId",
              source_id
            ) returning id into layer_id;
          elsif source.type = 'arcgis-dynamic-mapserver' then
            insert into data_sources (
              project_id,
              type,
              url,
              use_device_pixel_ratio,
              created_by
            ) values (
              "projectId",
              'arcgis-dynamic-mapserver',
              source.url,
              true,
              current_user_id()
            ) returning id into source_id;
            -- create data layers for each sublayer
            for i in array_lower(items, 1)..array_upper(items, 1) loop
              if items[i].sublayer_id is not null then
                insert into data_layers (
                  project_id,
                  data_source_id,
                  sublayer,
                  sublayer_type
                ) values (
                  "projectId",
                  source_id,
                  items[i].sublayer_id,
                  items[i].sublayer_type
                ) returning id into layer_id;
                interactive_layers = array_append(interactive_layers, layer_id);
                select 
                  id_lookup_set_key(layer_id_map, items[i].id, layer_id) 
                into layer_id_map;
              end if;
            end loop;
          else
            raise exception 'Source type % not supported', source.type;
          end if;
        end loop;
        if array_length(items, 1) > 1 then
          perform import_subtree("projectId", items, layer_id_map, null);
        else
          insert into table_of_contents_items (
            project_id,
            is_draft,
            is_folder,
            data_layer_id,
            title,
            stable_id,
            path
          ) values (
            "projectId",
            true,
            false,
            layer_id,
            items[1].title,
            items[1].stable_id,
            items[1].stable_id::ltree
          );
        end if;
        update interactivity_settings 
        set type = 'ALL_PROPERTIES_POPUP' 
        where id = any(
          (
            select 
              interactivity_settings_id 
            from 
              data_layers 
            where 
              id = any(interactive_layers)
          )
        );
      else
        raise exception 'Only admins can import ArcGIS services';
      end if;
    end;
  $$;
