--! Previous: sha1:b5b5d7581aecdff4c0bf6900ee0dda12964c83bf
--! Hash: sha1:58feff0709f6a71588025081035db380a663132d

-- Enter migration here
create or replace function clipping_layer_source(clipping_layer_id integer)
  returns table (
    url text,
    object_key text
  ) as $$
  select
    data_sources.url as url,
    geography_clipping_layers_object_key(geography_clipping_layers.*) as object_key
  from
    geography_clipping_layers
  inner join data_layers on geography_clipping_layers.data_layer_id = data_layers.id
  inner join data_sources on data_layers.data_source_id = data_sources.id
  where geography_clipping_layers.id = clipping_layer_id;
$$ language sql stable security definer;

grant execute on function clipping_layer_source to anon;
comment on function clipping_layer_source is '@omit';

create or replace function clipping_layers_for_geography(gid integer)
  returns table (
    id int,
    cql2_query jsonb,
    template_id text,
    object_key text,
    url text,
    operation_type geography_layer_operation
  ) as $$
  select
    gcl.id,
    gcl.cql2_query,
    gcl.template_id,
    data_layers_vector_object_key((select dl from data_layers dl where dl.id = gcl.data_layer_id)) as object_key,
    data_sources.url as url,
    gcl.operation_type
  from geography_clipping_layers gcl
  inner join data_layers on gcl.data_layer_id = data_layers.id
  inner join data_sources on data_layers.data_source_id = data_sources.id
  where gcl.project_geography_id = gid;
$$ language sql stable security definer;

grant execute on function clipping_layers_for_geography to anon;
comment on function clipping_layers_for_geography is '@omit';

drop function if exists clipping_layers_data_source(geography_clipping_layers);
drop function if exists geography_clipping_layers_data_source(geography_clipping_layers);
create or replace function geography_clipping_layers_data_source(clipping_layer geography_clipping_layers)
  returns data_sources
  language sql 
  stable 
  security definer as $$
  select * from data_sources
  where id = (select data_source_id from data_layers where id = clipping_layer.data_layer_id);
$$;

grant execute on function geography_clipping_layers_data_source to anon;
