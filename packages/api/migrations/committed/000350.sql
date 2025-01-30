--! Previous: sha1:0b98a0885770e236b10c99503304b68843ba6778
--! Hash: sha1:e5fd6b75c80686206effb13920537659cf26a874

-- Enter migration here
create or replace function table_of_contents_items_hosted_source_last_updated(t table_of_contents_items)
  returns timestamp with time zone
  language sql
  stable
  security definer
  as $$
    select
      created_at
    from
      data_upload_outputs
    where
      data_source_id = (
        select 
          data_source_id
        from
          data_layers
        where
          id = t.data_layer_id
        limit 1
      )
    limit 1;
  $$;

grant execute on function table_of_contents_items_hosted_source_last_updated(table_of_contents_items) to anon;
