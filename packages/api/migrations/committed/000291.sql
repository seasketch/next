--! Previous: sha1:f4cd21cedac1eb31ea84100cbf8d8a3452540402
--! Hash: sha1:d70db66b6510ada0a863d3d17bb89203fd3c8036

-- Enter migration here
grant execute on function table_of_contents_items_primary_download_url to anon;

alter table data_upload_outputs add column if not exists original_filename text;

update
  data_upload_outputs
set
  original_filename = data_sources.uploaded_source_filename
from
  data_sources
where
  data_upload_outputs.data_source_id = data_sources.id
and
  data_upload_outputs.is_original = true;

create or replace function table_of_contents_items_primary_download_url(item table_of_contents_items)
  returns text
  security definer
  stable
  language sql
  as $$
    select 
      case
        when item.enable_download = false then null
        when item.data_layer_id is null then null
        else
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
      end;
  $$;
