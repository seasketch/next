-- WMS overlay support (Phase 2 data model)

insert into data_source_types (type, description)
values ('wms', 'OGC Web Map Service (raster overlay)')
on conflict (type) do nothing;

alter table data_sources add column if not exists wms_settings jsonb;

comment on column data_sources.wms_settings is 'Service-level WMS configuration (version, crs, imageFormat, requestMode, etc.)';

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.before_insert_or_update_data_layers_trigger()
returns trigger
language plpgsql
as $$
  declare
    source_type text;
    max_z int;
  begin
    select type into source_type from data_sources where id = new.data_source_id;
    if source_type is null then
      raise 'Unknown source type. %', (new.data_source_id);
    end if;
    if new.sublayer is not null and source_type not in ('arcgis-dynamic-mapserver', 'wms') then
      raise 'sublayer property can only be specified for layers associated with an arcgis-dynamic-mapserver or wms source';
    end if;
    if source_type = 'vector' then
      if new.source_layer is null then
        raise 'Layers with "vector" data sources must specify a source_layer';
      end if;
    elsif source_type != 'seasketch-mvt' and source_type != 'seasketch-raster' and source_type != 'seasketch-vector' then
      if new.source_layer is not null then
        raise 'Only Layers with data_sources of type "vector", "seasketch-mvt", or "seasketch-raster" should specify a source_layer. Type was %', (source_type);
      end if;
    end if;
    if (source_type = 'vector' or source_type = 'geojson' or source_type = 'seasketch-vector' or source_type = 'seasketch-mvt') then
      if new.mapbox_gl_styles is null then
        raise 'Vector layers must specify mapbox_gl_styles';
      end if;
    else
      if new.mapbox_gl_styles is not null and source_type != 'seasketch-raster' and source_type != 'raster' then
        raise 'Layers with data_sources of type % should not specify mapbox_gl_styles', (source_type);
      end if;
    end if;
    if old is null and NEW.z_index = 0 then
      select max(z_index) + 1 into max_z from data_layers where project_id = new.project_id;
      if max_z is null then
        max_z = 0;
      end if;
      new.z_index = max_z;
    end if;
    return new;
  end;
$$;

create or replace function public.before_insert_or_update_data_sources_trigger()
returns trigger
language plpgsql
as $$
  declare
    bucket_id text;
  begin
    if new.type = 'arcgis-dynamic-mapserver-raster-sublayer' then
      raise exception 'arcgis-dynamic-mapserver-raster-sublayer is not a valid data source type. It is only to be used as a table of contents item data_source_type value.';
    end if;
    if new.type = 'arcgis-dynamic-mapserver-vector-sublayer' then
      raise exception 'arcgis-dynamic-mapserver-vector-sublayer is not a valid data source type. It is only to be used as a table of contents item data_source_type value.';
    end if;
    if new.minzoom is not null and (new.type != 'vector' and new.type != 'raster' and new.type != 'raster-dem' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' and new.type != 'arcgis-raster-tiles' and new.type != 'wms') then
      raise 'minzoom may only be set for tiled sources (vector, raster, raster-dem)';
    end if;
    if new.coordinates is null and (new.type = 'video' or new.type = 'image') then
      raise 'coordinates must be set on image and video sources';
    end if;
    if new.coordinates is not null and (new.type != 'video' and new.type != 'image') then
      raise 'coordinates property can only be set on image and video sources';
    end if;
    if new.maxzoom is not null and (new.type = 'image' or new.type = 'video') then
      raise 'maxzoom cannot be set for image and video sources';
    end if;
    if new.url is null and (new.type = 'geojson' or new.type = 'image' or new.type = 'arcgis-dynamic-mapserver' or new.type = 'arcgis-vector' or new.type = 'seasketch-mvt' or new.type = 'wms') then
      raise 'url must be set for "%" sources', (new.type);
    end if;
    if new.scheme is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt') then
      raise 'scheme property is not allowed for "%" sources', (new.type);
    end if;
    if new.tiles is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-vector') then
      raise 'tiles property is not allowed for "%" sources', (new.type);
    end if;
    if new.encoding is not null and new.type != 'raster-dem' then
      raise 'encoding property only allowed on raster-dem sources';
    end if;
    if new.tile_size is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' and new.type != 'inaturalist' and new.type != 'wms') then
      raise 'tile_size property is not allowed for "%" sources', (new.type);
    end if;
    if (new.type != 'geojson' and new.type != 'seasketch-vector') and (new.buffer is not null or new.cluster is not null or new.cluster_max_zoom is not null or new.cluster_properties is not null or new.cluster_radius is not null or new.generate_id is not null or new.line_metrics is not null or new.promote_id is not null or new.tolerance is not null) then
      raise 'geojson props such as buffer, cluster, generate_id, etc not allowed on % sources', (new.type);
    end if;
    if (new.byte_length is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster') then
      raise 'byte_length can only be set on seasketch-vector, seasketch_mvt and seasketch-raster sources';
    end if;
    if (new.type = 'seasketch-vector' and new.type != 'seasketch-mvt' and new.byte_length is null) then
      raise 'seasketch-vector and mvt sources must have byte_length set to an approximate value';
    end if;
    if new.urls is not null and new.type != 'video' then
      raise 'urls property not allowed on % sources', (new.type);
    end if;
    if new.query_parameters is not null and (new.type != 'arcgis-vector' and new.type != 'arcgis-dynamic-mapserver' and new.type != 'inaturalist' and new.type != 'wms') then
      raise 'query_parameters property not allowed on % sources', (new.type);
    end if;
    if new.use_device_pixel_ratio is not null and (new.type != 'arcgis-dynamic-mapserver' and new.type != 'arcgis-raster-tiles' and new.type != 'wms') then
      raise 'use_device_pixel_ratio property not allowed on % sources', (new.type);
    end if;
    if new.wms_settings is not null and new.type != 'wms' then
      raise 'wms_settings property is only allowed on wms sources';
    end if;
    if new.type = 'wms' and new.wms_settings is null then
      raise 'wms_settings is required for wms sources';
    end if;
    if new.import_type is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' then
      raise 'import_type property is only allowed for seasketch-vector, seasketch-mvt, and seasketch-raster sources';
    end if;
    if new.import_type is null and (new.type = 'seasketch-vector' or new.type = 'seasketch-mvt') then
      raise 'import_type property is required for seasketch-vector sources';
    end if;
    if new.original_source_url is not null and (new.type != 'seasketch-vector' and new.type != 'seasketch-mvt') then
      raise 'original_source_url may only be set on seasketch-vector sources';
    end if;
    if new.enhanced_security is not null and new.type != 'seasketch-vector' then
      raise 'enhanced_security may only be set on seasketch-vector sources';
    end if;
    if old is null and new.type = 'seasketch-vector' then
      if new.bucket_id is null then
        new.bucket_id = (select data_sources_bucket_id from projects where id = new.project_id);
      end if;
      if new.object_key is null then
        new.object_key = (select gen_random_uuid());
      end if;
      new.tiles = null;
    end if;
    return new;
  end;
$$;

create or replace function public.data_source_type(data_layer_id integer)
returns text
language sql
as $$
  select
    (
      case
        when data_layers.sublayer is not null and data_sources.type = 'arcgis-dynamic-mapserver' then
          'arcgis-dynamic-mapserver-' || data_layers.sublayer_type || '-sublayer'
        else
          data_sources.type
      end
    ) as data_source_type
  from
    data_layers
  inner join
    data_sources
  on
    data_layers.data_source_id = data_sources.id
  where
    data_layers.id = data_layer_id;
$$;

create or replace function public.table_of_contents_items_uses_dynamic_metadata(t public.table_of_contents_items)
returns boolean
language plpgsql
stable
as $$
  declare
    uses_dynamic_metadata boolean;
  begin
    select type = 'arcgis-dynamic-mapserver' or type = 'arcgis-vector' or type = 'arcgis-raster-tiles' or type = 'wms'
    into uses_dynamic_metadata
    from data_sources
    where id = (select data_source_id from data_layers where id = t.data_layer_id);
    return uses_dynamic_metadata;
  end;
$$;

-- ---------------------------------------------------------------------------
-- Import types + functions
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.wms_import_item as (
    id integer,
    is_folder boolean,
    title text,
    source_id integer,
    parent_id text,
    sublayer_name text,
    stable_id text,
    queryable boolean
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.wms_import_source as (
    id integer,
    url text,
    wms_settings jsonb,
    bounds float8[],
    attribution text,
    use_device_pixel_ratio boolean,
    query_parameters jsonb,
    tile_size integer,
    minzoom integer,
    maxzoom integer
  );
exception when duplicate_object then null;
end $$;

create or replace function public.import_wms_subtree(
  "projectId" integer,
  items public.wms_import_item[],
  layer_id_lookup jsonb,
  path public.ltree
)
returns integer
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
        elsif items[i].sublayer_name is not null then
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
          perform import_wms_subtree("projectId", items, layer_id_lookup, item_path);
        end if;
      end if;
    end loop;
    return 0;
  end;
$$;

create or replace function public.import_wms_service(
  "projectId" integer,
  items public.wms_import_item[],
  sources public.wms_import_source[]
)
returns setof public.table_of_contents_items
language plpgsql
security definer
as $$
  declare
    source wms_import_source;
    source_id int;
    layer_id int;
    layer_id_map jsonb;
    interactive_layers int[];
    item wms_import_item;
  begin
    layer_id_map = '{}'::jsonb;
    interactive_layers = array[]::int[];
    if session_is_admin("projectId") then
      for i in array_lower(sources, 1)..array_upper(sources, 1) loop
        source = sources[i];
        insert into data_sources (
          project_id,
          type,
          url,
          bounds,
          attribution,
          use_device_pixel_ratio,
          query_parameters,
          tile_size,
          minzoom,
          maxzoom,
          wms_settings,
          created_by
        ) values (
          "projectId",
          'wms',
          source.url,
          source.bounds,
          source.attribution,
          coalesce(source.use_device_pixel_ratio, true),
          source.query_parameters,
          source.tile_size,
          source.minzoom,
          source.maxzoom,
          source.wms_settings,
          current_user_id()
        ) returning id into source_id;

        for j in array_lower(items, 1)..array_upper(items, 1) loop
          item = items[j];
          if item.source_id = source.id and item.sublayer_name is not null then
            insert into data_layers (
              project_id,
              data_source_id,
              sublayer
            ) values (
              "projectId",
              source_id,
              item.sublayer_name
            ) returning id into layer_id;
            if coalesce(item.queryable, false) then
              interactive_layers = array_append(interactive_layers, layer_id);
            end if;
            select id_lookup_set_key(layer_id_map, item.id, layer_id)
            into layer_id_map;
          end if;
        end loop;
      end loop;

      if array_length(items, 1) > 1 then
        perform import_wms_subtree("projectId", items, layer_id_map, null);
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

      if array_length(interactive_layers, 1) > 0 then
        update interactivity_settings
        set type = 'ALL_PROPERTIES_POPUP'
        where id = any(
          select interactivity_settings_id
          from data_layers
          where id = any(interactive_layers)
        );
      end if;
    else
      raise exception 'Only admins can import WMS services';
    end if;
  end;
$$;

grant execute on function public.import_wms_service(integer, public.wms_import_item[], public.wms_import_source[]) to seasketch_user;
grant execute on function public.import_wms_subtree(integer, public.wms_import_item[], jsonb, public.ltree) to seasketch_user;

create or replace function public.projects_imported_wms_services(p public.projects)
returns text[]
language plpgsql
stable
security definer
as $$
  declare
    services text[];
  begin
    if true or session_is_admin(p.id) then
      select array_agg(distinct url)
      into services
      from data_sources
      where project_id = p.id and type = 'wms';
      return services;
    else
      raise exception 'Permission denied';
    end if;
  end;
$$;

grant execute on function public.projects_imported_wms_services(public.projects) to anon;
grant execute on function public.projects_imported_wms_services(public.projects) to seasketch_user;

comment on function public.projects_imported_wms_services(public.projects) is '@sortable';

-- publish_table_of_contents: include wms_settings when copying data_sources

CREATE OR REPLACE FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      v_editor int;
      v_layer_count int;
      lid int;
      item table_of_contents_items;
      source_id int;
      copied_source_id int;
      acl_type access_control_list_type;
      acl_id int;
      orig_acl_id int;
      new_toc_id int;
      new_interactivity_settings_id int;
      new_source_id integer;
      ref record;
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
          wms_settings,
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
          wms_settings,
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
          original_filename,
          source_processing_job_key,
          epsg
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
            original_filename,
            source_processing_job_key,
            epsg
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

      v_editor := nullif(current_setting('session.user_id', true), '')::int;
      if v_editor is not null then
        select count(*)::int into v_layer_count
        from table_of_contents_items
        where project_id = "projectId"
          and is_draft = true
          and is_folder = false;

        perform record_changelog(
          "projectId",
          v_editor,
          'projects',
          "projectId",
          'layers:published'::change_log_field_group,
          '{}'::jsonb,
          jsonb_build_object('layer_count', v_layer_count),
          null,
          null,
          null
        );
      end if;
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;
