--! Previous: sha1:c66ad84cc3b4148765b9252e0ff0fb86a603d8c0
--! Hash: sha1:555fe91651bf60d45b9ccc601c94793b40b2afff

-- Enter migration here

DO $$ BEGIN
IF to_regtype('public.sublayer_type') IS NULL THEN
  create type sublayer_type as enum (
    'raster',
    'vector'
  );
END IF;
END $$;

alter table data_layers add column if not exists sublayer_type sublayer_type;


-- create type arcgis_import_item as (
--   id int,
--   is_folder boolean,
--   title text,
--   source_id int,
--   parent_id text,
--   sublayer_id int,
--   stable_id text
-- );

DO $$ BEGIN
IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_class c ON c.oid = t.typrelid
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE t.typname = 'arcgis_import_item' 
    AND a.attname = 'sublayer_type'
    ) THEN
alter type arcgis_import_item add attribute sublayer_type sublayer_type;
END IF;
END $$;


CREATE OR REPLACE FUNCTION public.import_arcgis_services("projectId" integer, items public.arcgis_import_item[], sources public.arcgis_import_source[]) RETURNS SETOF public.table_of_contents_items
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
            interactive_layers = array_append(interactive_layers, layer_id);
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
