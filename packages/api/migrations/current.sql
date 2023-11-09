-- Enter migration here

drop function if exists import_arcgis_services;

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
  parent_id int,
  sublayer_id int,
  stable_id text
);

create type arcgis_import_source as (
  id int,
  type arcgis_source_type,
  url text,
  fetch_strategy arcgis_feature_layer_fetch_strategy
);


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
      source_id_map = '[]'::jsonb;
      layer_id_map = '[]'::jsonb;
      item_id_map = '[]'::jsonb;
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
              jsonb_set(
                source_id_map, 
                array[source.id::text], 
                source_id::text::jsonb
              ) 
            into source_id_map;
            insert into data_layers (
              project_id,
              data_source_id
            ) values (
              "projectId",
              (source_id_map->source.id)::int
            ) returning id into layer_id;
            select 
              jsonb_set(
                layer_id_map, 
                array[source.id::text], 
                layer_id::text::jsonb
              )
            into layer_id_map;
          else
            raise exception 'Source type % not supported', source.type;
          end if;
        end loop;
        for i in array_lower(items, 1)..array_upper(items, 1) loop
          insert into table_of_contents_items (
            project_id,
            is_draft,
            is_folder,
            data_layer_id,
            title,
            stable_id
            -- path
          ) values (
            "projectId",
            true,
            items[i].is_folder,
            (layer_id_map->items[i].source_id)::int,
            items[i].title,
            items[i].stable_id
            -- items[i].stable_id::ltree
          ) returning id into item_id;
        end loop;
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
