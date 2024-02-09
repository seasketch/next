--! Previous: sha1:e62ed96d50805144d7f6100034cdaa6720ed2d9a
--! Hash: sha1:35b6c3f76b8295a308bbf8451396d2b6eb99fa6a

-- Enter migration here
CREATE OR REPLACE FUNCTION public.projects_eligable_downloadable_layers_count(p public.projects) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select 
      count(id)::int 
    from 
      table_of_contents_items 
    where 
      project_id = p.id and 
      is_draft = true and 
      is_folder = false and 
      enable_download = false and 
      (
        table_of_contents_items_has_original_source_upload(table_of_contents_items.*)
        or
        table_of_contents_items_has_arcgis_vector_layer(
          table_of_contents_items.*
        )
      )
    ;
  $$;

CREATE OR REPLACE FUNCTION projects_downloadable_layers_count(
  p public.projects) 
  RETURNS integer
  LANGUAGE sql STABLE
  AS $$
    select 
      count(id)::int 
    from 
      table_of_contents_items 
    where 
      project_id = p.id and 
      is_draft = true and 
      is_folder = false and 
      enable_download = true and 
      (
        table_of_contents_items_has_original_source_upload(
          table_of_contents_items.*
        )
        or
        table_of_contents_items_has_arcgis_vector_layer(
          table_of_contents_items.*
        )
      );
$$;


CREATE OR REPLACE FUNCTION table_of_contents_items_has_arcgis_vector_layer(
  item public.table_of_contents_items
  ) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select 
      exists(
        select 
          id 
        from 
          data_layers 
        where 
          data_layers.id = item.data_layer_id and 
        exists(
          select 
            id 
          from 
            data_sources 
          where 
            data_sources.id = data_layers.data_source_id and 
            (
              data_sources.type = 'arcgis-vector'
              or
              (
                data_sources.type = 'arcgis-dynamic-mapserver' and
                data_layers.sublayer_type = 'vector'
              )
            )
        )
      );
  $$;

CREATE OR REPLACE FUNCTION table_of_contents_items_primary_download_url(
  item public.table_of_contents_items
  ) RETURNS text
    LANGUAGE sql 
    STABLE 
    SECURITY DEFINER
    AS $$
    
    with related_data_layer as (
      select 
        *
      from 
        data_layers
      where 
        data_layers.id = item.data_layer_id
    ), related_data_source as (
      select 
        *
      from 
        data_sources
      where 
        data_sources.id = (
          select 
            related_data_layer.data_source_id
          from
            related_data_layer
          where 
            related_data_layer.id = item.data_layer_id and
            (
              data_sources.type = 'arcgis-vector' or
              (
                data_sources.type = 'arcgis-dynamic-mapserver' and
                exists(
                  select 
                    sublayer_type 
                  from 
                    related_data_layer 
                  where 
                    sublayer_type = 'vector'
                )
              )
            )
        )
    )
    select 
      case
        when item.enable_download = false then null
        when item.data_layer_id is null then null
        when item.is_folder = true then null
        when (exists(select * from related_data_source)) then (
          select 
            'https://arcgis-export.seasketch.org/?download=' || item.title || '&location=' || url || '/' || (
              select coalesce(sublayer, '') from related_data_layer
            )
          from
            related_data_source 
          limit 1
        )
        else (
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
      end;
  $$;
