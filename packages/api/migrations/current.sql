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
