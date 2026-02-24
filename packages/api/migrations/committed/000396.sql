--! Previous: sha1:853045ab789ab6008aa497f45f467c889147007f
--! Hash: sha1:452069702713b602d3b4e23f99301126673142cd

-- Enter migration here
create or replace function project_geography_stable_ids(geography project_geography)
returns text[]
language sql
security definer
stable
as $$
  select 
    array(
      select stable_id from table_of_contents_items where data_layer_id in (
        select data_layer_id from geography_clipping_layers where project_geography_id = geography.id
      )
      order by (copied_from_data_library_template_id = 'DAYLIGHT_COASTLINE')::int, stable_id
  );
$$;

grant execute on function project_geography_stable_ids to anon;
