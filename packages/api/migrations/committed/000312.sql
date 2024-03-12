--! Previous: sha1:2c04357e15408a17660fe40f5f24fcf1f5fe1c5f
--! Hash: sha1:7c24ab0b63a0ab43203b8ffa6679ea2a0a0da71e

-- Enter migration here

create or replace function make_url_source_metadata(title text, url text)
  returns jsonb
  language plpgsql
  as $$
    declare
      metadata jsonb;

    begin
      metadata := jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'heading',
            'attrs', jsonb_build_object(
              'level', 1
            ),
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'text',
                'text', title
              )
            )
          ),
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'text',
                'text', url,
                'marks', jsonb_build_array(
                  jsonb_build_object(
                    'type', 'link',
                    'attrs', jsonb_build_object(
                      'href', url,
                      'title', 'GeoJSON'
                    )
                  )
                )
              )
            )
          )
        )
      );
      return metadata;
    end;
  $$;

grant execute on function make_url_source_metadata to anon;
comment on function make_url_source_metadata is '@omit';

drop function if exists create_remote_geojson_source;
create or replace function create_remote_geojson_source(slug text, url text, geostats jsonb, bounds numeric[])
  returns table_of_contents_items
  security definer
  language plpgsql
  as $$
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
          geostats
        ) values (
          pid,
          'geojson',
          create_remote_geojson_source.url,
          create_remote_geojson_source.geostats
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


grant execute on function create_remote_geojson_source to seasketch_user;

CREATE OR REPLACE FUNCTION public.table_of_contents_items_is_downloadable_source_type(item public.table_of_contents_items) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select 
      item.data_source_type = 'arcgis-dynamic-mapserver-vector-sublayer' or
      item.data_source_type = 'arcgis-vector' or
      item.data_source_type = 'geojson' or
      (
        (
          item.data_source_type = 'seasketch-vector' or
          item.data_source_type = 'seasketch-mvt' or
          item.data_source_type = 'seasketch-raster'
        ) and 
        item.original_source_upload_available = true
      );
  $$;

CREATE OR REPLACE FUNCTION public.table_of_contents_items_primary_download_url(item public.table_of_contents_items) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      case
        when item.enable_download = false then null
        when item.data_layer_id is null then null
        when item.is_folder = true then null
        when not table_of_contents_items_is_downloadable_source_type(item) then null 
        when item.data_source_type = 'seasketch-mvt' or 
          item.data_source_type = 'seasketch-vector' then
          (
            select 
                data_upload_outputs.url || '?download=' || data_upload_outputs.original_filename
            from 
              data_upload_outputs
            where 
              data_upload_outputs.data_source_id = (
                select 
                  data_layers.data_source_id
                from 
                  data_layers
                where 
                  data_layers.id = item.data_layer_id
              )
            and 
              data_upload_outputs.is_original = true
              limit 1
          )
        when item.data_source_type = 'geojson' then
          (
            select 
              url 
            from 
              data_sources 
            where id = (
              select 
                data_source_id 
              from 
                data_layers 
              where data_layers.id = item.data_layer_id
            )
          ) 
        else (
          select 
            'https://arcgis-export.seasketch.org/?download=' || 
            item.title || 
            '&location=' || 
            data_sources.url || 
            '/' || 
            coalesce(data_layers.sublayer, '')
          from
            data_layers
          inner join
            data_sources
          on
            data_sources.id = data_layers.data_source_id
          where
            data_layers.id = item.data_layer_id
          limit 1
        )
      end;
  $$;
