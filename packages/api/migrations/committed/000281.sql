--! Previous: sha1:6084ad8c19dffb844ed6a49cab24caac6dc51841
--! Hash: sha1:077e1ed1e4f045a9336afed1444ff35444bcd3db

-- Enter migration here

drop function if exists import_arcgis_services;
drop function if exists import_subtree;

drop type if exists arcgis_import_item;
drop type if exists arcgis_import_source;
drop type if exists arcgis_source_type;

create type arcgis_source_type as enum (
  'arcgis-dynamic-mapserver',
  'arcgis-vector',
  'arcgis-raster-tiles'
);

create type arcgis_import_item as (
  id int,
  is_folder boolean,
  title text,
  source_id int,
  parent_id text,
  sublayer_id int,
  stable_id text
);

create type arcgis_import_source as (
  id int,
  type arcgis_source_type,
  url text,
  fetch_strategy arcgis_feature_layer_fetch_strategy
);


create or replace function id_lookup_set_key(lookup jsonb, key int, value int)
  returns jsonb
  language plpgsql
  as $$
    begin
      if lookup is null then
        raise exception 'lookup is null';
      else
        raise warning 'key: %, value: %', key, value;
        return jsonb_set(
                lookup, 
                array[key::text], 
                value::text::jsonb
              );
      end if;
    end;
  $$;

create or replace function id_lookup_get_key(lookup jsonb, key int)
  returns int
  language plpgsql
  as $$
    begin
      if lookup is null then
        raise exception 'lookup is null';
      else
        if (lookup->key::text)::int is null then
          raise exception 'key % not found in lookup. %', key::text, lookup;
        else
          return (lookup->key::text)::int;
        end if;
      end if;
    end;
  $$;

create or replace function import_subtree("projectId" int, items arcgis_import_item[], layer_id_lookup jsonb, path ltree)
  returns int
  language plpgsql
  security definer
  as $$
    declare
      item_path ltree;
      layer_id int;
      parent_sid text;
    begin
      for i in array_lower(items, 1)..array_upper(items, 1) loop
        if (path is null and items[i].parent_id is null) or items[i].parent_id = subpath(path, -1, 1)::text then
          if path is null then
            item_path = items[i].stable_id::ltree;
            parent_sid = null;
          else
            item_path = path || items[i].stable_id::ltree;
            parent_sid = subpath(path, -1, 1)::text;
          end if;
          if items[i].is_folder = true then
            layer_id = null;
          elsif items[i].sublayer_id is not null then
            layer_id = id_lookup_get_key(layer_id_lookup, items[i].id);
          else
            layer_id = id_lookup_get_key(layer_id_lookup, items[i].source_id);
          end if;
          insert into table_of_contents_items (
            project_id,
            is_draft,
            is_folder,
            data_layer_id,
            title,
            stable_id,
            path,
            parent_stable_id
          ) values (
            "projectId",
            true,
            items[i].is_folder,
            layer_id,
            items[i].title,
            items[i].stable_id,
            item_path,
            parent_sid
          );
          if items[i].is_folder = true then
            perform import_subtree("projectId", items, layer_id_lookup, item_path);
          end if;
        end if;
      end loop;
      return 0;
    end;
  $$;


create or replace function import_arcgis_services("projectId" int, items arcgis_import_item[], sources arcgis_import_source[])
  returns setof table_of_contents_items
  language plpgsql
  security definer
  as $$
    declare 
      folder_id int;
      source arcgis_import_source;
      source_id int;
      layer_id int;
      item_id int;
      source_id_map jsonb;
      layer_id_map jsonb;
      item_id_map jsonb;
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
              arcgis_fetch_strategy
            ) values (
              "projectId", 
              'arcgis-vector', 
              source.url, 
              source.fetch_strategy
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
          elsif source.type = 'arcgis-raster-tiles' then
            insert into data_sources (
              project_id, 
              type,
              url
            ) values (
              "projectId", 
              'arcgis-raster-tiles', 
              source.url
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
              url
            ) values (
              "projectId",
              'arcgis-dynamic-mapserver',
              source.url
            ) returning id into source_id;
            -- create data layers for each sublayer
            for i in array_lower(items, 1)..array_upper(items, 1) loop
              if items[i].sublayer_id is not null then
                insert into data_layers (
                  project_id,
                  data_source_id,
                  sublayer
                ) values (
                  "projectId",
                  source_id,
                  items[i].sublayer_id
                ) returning id into layer_id;
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
      else
        raise exception 'Only admins can import ArcGIS services';
      end if;
    end;
  $$;





grant execute on function import_arcgis_services to seasketch_user;


CREATE or replace FUNCTION public.projects_imported_arcgis_services(p public.projects) RETURNS text[]
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      services text[];
    begin
      if session_is_admin(p.id) then
        select 
          array_agg(coalesce(url, original_source_url)) as url 
        into
          services
        from
        (
          select
            basemaps.url, data_sources.original_source_url
          from basemaps, data_sources
          where 
          (
            basemaps.project_id = p.id and
            basemaps.is_arcgis_tiled_mapservice = true
          ) or
          (
            data_sources.project_id = p.id and
            (
              data_sources.type = 'arcgis-raster-tiles' or 
              data_sources.type = 'arcgis-vector' or 
              data_sources.type = 'arcgis-dynamic-mapserver'
            )
          )
        ) q;
        return services;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;


CREATE OR REPlACE FUNCTION public.projects_imported_arcgis_services(p public.projects) RETURNS text[]
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      data_sources_services text[];
      basemap_services text[];
    begin
      if true or session_is_admin(p.id) then
        select
          array_agg(distinct(REGEXP_REPLACE(url, '/[0-9]+$', '')))
        into 
          basemap_services
        from
          basemaps
        where
          is_arcgis_tiled_mapservice = true and
          project_id = p.id;
        select
          array_agg(distinct(REGEXP_REPLACE(url, '/[0-9]+$', '')))
        from 
          data_sources
        into
          data_sources_services
        where
          project_id = p.id and
          type in ('arcgis-raster-tiles', 'arcgis-vector', 'arcgis-dynamic-mapserver');
        return array_cat(data_sources_services, basemap_services);
      else
        raise exception 'Permission denied';
      end if;
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
            interactivity_settings_id,
            z_index
          )
          select "projectId", 
            data_source_id, 
            source_layer, 
            sublayer, 
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
          translated_props
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
          item.translated_props
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
          arcgis_fetch_strategy
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
          arcgis_fetch_strategy
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
