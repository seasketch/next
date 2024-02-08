--! Previous: sha1:ab079f30cd7bd38724ad2f66c10fb1c4add93c5b
--! Hash: sha1:c66ad84cc3b4148765b9252e0ff0fb86a603d8c0

-- Enter migration here
update table_of_contents_items set enable_download = false where id = any (
  select 
    table_of_contents_items.id
  from
    table_of_contents_items
  join
    data_layers
  on
    table_of_contents_items.data_layer_id = data_layers.id
  join
    data_sources
  on
    data_layers.data_source_id = data_sources.id
  where
    data_sources.type = 'arcgis-vector' and
    table_of_contents_items.is_draft = true
);

CREATE OR REPLACE FUNCTION public.table_of_contents_items_primary_download_url(item public.table_of_contents_items) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    with related_data_source as (
      select 
        *
      from 
        data_sources
      where 
        data_sources.id = (
          select 
            data_layers.data_source_id
          from
            data_layers
          where 
            data_layers.id = item.data_layer_id and
            data_sources.type = 'arcgis-vector'
        )
    )
    select 
      case
        when item.enable_download = false then null
        when item.data_layer_id is null then null
        when item.is_folder = true then null
        when (exists(select * from related_data_source)) then (
          select 
            'https://arcgis-export.seasketch.org/?download=' || item.title || '&location=' || url
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

  create or replace function table_of_contents_items_has_arcgis_vector_layer(item table_of_contents_items)
  returns boolean
  language sql
  stable
  as $$
    select exists(select * from data_layers where data_layers.id = item.data_layer_id and exists(select * from data_sources where data_sources.id = data_layers.data_source_id and data_sources.type = 'arcgis-vector'));
  $$;

  grant execute on function table_of_contents_items_has_arcgis_vector_layer(table_of_contents_items) to anon;


  create or replace function projects_downloadable_layers_count(p projects)
  returns int
  language sql
  stable
  as $$
    select count(id)::int from table_of_contents_items where project_id = p.id and is_draft = true and is_folder = false and enable_download = true and (
      table_of_contents_items_has_original_source_upload(table_of_contents_items.*)
      or
      table_of_contents_items_has_arcgis_vector_layer(table_of_contents_items.*)
    );
  $$;

create or replace function projects_eligable_downloadable_layers_count(p projects)
  returns int
  language sql
  stable
  as $$
    select count(id)::int from table_of_contents_items where project_id = p.id and is_draft = true and is_folder = false and enable_download = false and (
      table_of_contents_items_has_original_source_upload(table_of_contents_items.*)
      or
      table_of_contents_items_has_arcgis_vector_layer(table_of_contents_items.*)
    );
  $$;
