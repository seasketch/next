--! Previous: sha1:caf7c3f8b2fa4bb16e15115d9da934764e27d62f
--! Hash: sha1:009759ddca8c61b65f68a7109f9dea7886c045ba

-- Enter migration here
CREATE OR REPLACE FUNCTION public.data_layers_vector_geometry_type(d public.data_layers) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select jsonb_array_elements(geostats->'layers')->>'geometry'
  from data_sources
  where id = d.data_source_id
  limit 1
$$;
