--! Previous: sha1:225b7cc3b691da25d56a687c5f8004ff15207444
--! Hash: sha1:caf7c3f8b2fa4bb16e15115d9da934764e27d62f

-- Enter migration here
create or replace function data_layers_vector_geometry_type(d data_layers)
returns text
language sql
stable
security definer
as $$
-- selects "geometry" property from first layer in "geostats" jsonb column
-- of the related data_source, if it exists. Otherwise returns null
select (
  select jsonb_array_elements(geostats->'layers')->>'geometry'
  from data_sources
  where id = d.data_source_id
  limit 1
)
from data_layers d
where d.id = d.id;
$$;

grant execute on function data_layers_vector_geometry_type(data_layers) to anon;

comment on function data_layers_vector_geometry_type(data_layers) is 'Returns the ogc geometry type of the layer if it is a vector layer, otherwise returns null. E.g. "Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon".';
