--! Previous: sha1:ca6ecb7392982b4cf2f34945540f9eb4c72d8c6b
--! Hash: sha1:003d4c5aabd3afdef48c4bf9a0bffa47d20ded98

-- Enter migration here
drop function if exists export_spatial_responses;
create or replace function export_spatial_responses(fid int)
  returns json
  language plpgsql
  security definer
  as $$
    declare
      output json;
    begin
    if (true or session_is_admin(project_id_from_field_id(fid))) then
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(jsonb_build_object(
    'type',       'Feature',
    'id',         id,
    'geometry',   ST_AsGeoJSON(coalesce(geom, user_geom))::jsonb,
    'properties', sketches.properties::jsonb || to_jsonb(json_build_object('response_id', sketches.response_id, 'name', sketches.name))
    ))
        ) FROM sketches where form_element_id = fid into output;
        return output;
    else 
      raise exception 'Not authorized';
    end if;
    end;
  $$;

grant execute on function export_spatial_responses to seasketch_user;
