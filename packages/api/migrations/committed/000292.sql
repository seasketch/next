--! Previous: sha1:d70db66b6510ada0a863d3d17bb89203fd3c8036
--! Hash: sha1:dd418c91588b73943d5eabd3430341febd583459

-- Enter migration here

drop function if exists table_of_contents_items_download_options(item table_of_contents_items) cascade;
drop type if exists download_option cascade;
create type download_option as (
  type data_upload_output_type,
  url text,
  is_original boolean,
  size bigint
);

create or replace function table_of_contents_items_download_options(item table_of_contents_items)
  returns setof download_option
  language sql
  stable
  security definer
  as $$
    select
      type,
      (case when is_original then 
        replace(url, 'tiles.seasketch.org', 'uploads.seasketch.org') || '?download=' || original_filename 
      else 
        replace(url, 'tiles.seasketch.org', 'uploads.seasketch.org') || '?download=' || substring(original_filename from '(.*)\.\w+$') || substring(url from '.*(\.\w+)$')
      end) as url,
      is_original,
      size
    from
      data_upload_outputs
    where
      data_upload_outputs.data_source_id = (
        select data_source_id from data_layers where data_layers.id = item.data_layer_id
      );
  $$;

grant execute on function table_of_contents_items_download_options(table_of_contents_items) to anon;


comment on function table_of_contents_items_download_options(table_of_contents_items) is '@simpleCollections only';
