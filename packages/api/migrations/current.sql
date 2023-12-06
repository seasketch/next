-- Enter migration here
CREATE OR REPLACE FUNCTION public.before_insert_or_update_data_sources_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  declare
    bucket_id text;
  begin
    if new.minzoom is not null and (new.type != 'vector' and new.type != 'raster' and new.type != 'raster-dem' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' and new.type != 'arcgis-raster-tiles' ) then
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
    if new.url is null and (new.type = 'geojson' or new.type = 'image' or new.type = 'arcgis-dynamic-mapserver' or new.type = 'arcgis-vector' or new.type = 'seasketch-mvt') then
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
    if new.tile_size is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster') then
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
    if new.query_parameters is not null and (new.type != 'arcgis-vector' and new.type != 'arcgis-dynamic-mapserver') then
      raise 'query_parameters property not allowed on % sources', (new.type);
    end if;
    if new.use_device_pixel_ratio is not null and new.type != 'arcgis-dynamic-mapserver' then
      raise 'use_device_pixel_ratio property not allowed on % sources', (new.type);
    end if;
    if new.import_type is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' then
      raise 'import_type property is only allowed for seasketch-vector, seasketch-mvt, and seasketch-raster sources';
    end if;
    if new.import_type is null and (new.type = 'seasketch-vector' or new.type = 'seasketch-mvt') then
      raise 'import_type property is required for seasketch-vector sources';
    end if;
    if new.original_source_url is not null and new.type != 'seasketch-vector' then
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

drop policy if exists data_sources_update on data_sources;
CREATE POLICY data_sources_update ON public.data_sources FOR UPDATE USING ((public.session_is_admin(project_id) AND ( SELECT (( SELECT 1
           FROM public.table_of_contents_items
          WHERE ((table_of_contents_items.data_layer_id in ( SELECT data_layers.id
                   FROM public.data_layers
                  WHERE (data_layers.data_source_id = data_sources.id))) AND (table_of_contents_items.is_draft = false))) IS NULL)))) WITH CHECK (public.session_is_admin(project_id));


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
              url,
              use_device_pixel_ratio
            ) values (
              "projectId", 
              'arcgis-raster-tiles', 
              source.url,
              true
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
              use_device_pixel_ratio
            ) values (
              "projectId",
              'arcgis-dynamic-mapserver',
              source.url,
              true
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

grant update (arcgis_fetch_strategy) on data_sources to seasketch_user;

alter table basemaps add column if not exists maxzoom int;

create or replace function table_of_contents_items_uses_dynamic_metadata(t table_of_contents_items)
  returns boolean
  language plpgsql
  security definer
  stable
  as $$
    declare
      uses_dynamic_metadata boolean;
    begin
      if t.metadata is not null then
        return false;
      end if;
      if t.data_layer_id is null then
        return false;
      end if;
      select type = 'arcgis-dynamic-mapserver' or type = 'arcgis-vector' or type = 'arcgis-raster-tiles' into uses_dynamic_metadata from data_sources where id = (select data_source_id from data_layers where id = t.data_layer_id);
      return uses_dynamic_metadata;
    end;
  $$;

grant execute on function table_of_contents_items_uses_dynamic_metadata(table_of_contents_items) to anon;

create or replace function table_of_contents_items_is_custom_gl_source(t table_of_contents_items)
  returns boolean
  language plpgsql
  security definer
  stable
  as $$
    declare
      source_type text;
    begin
      if t.data_layer_id is null then
        return null;
      end if;
      select type into source_type from data_sources where id = (select data_source_id from data_layers where id = t.data_layer_id);
      return source_type = 'arcgis-dynamic-mapserver' or source_type = 'arcgis-vector' or source_type = 'arcgis-raster-tiles';
    end;
  $$;

grant execute on function table_of_contents_items_is_custom_gl_source(table_of_contents_items) to anon;