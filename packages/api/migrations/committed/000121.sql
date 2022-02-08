--! Previous: sha1:32e343c59d61d9f36b56e393c5986d408efe4c00
--! Hash: sha1:f17ec0db8d5bc41a0fc992b76ba47035cc52bd68

-- Enter migration here
CREATE OR REPLACE FUNCTION public.export_spatial_responses(fid integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      output json;
    begin
    if (true or session_is_admin(project_id_from_field_id(fid))) then
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(jsonb_build_object(
            'type',       'Feature',
            'id',         sketches.id,
            'geometry',   ST_AsGeoJSON(coalesce(geom, user_geom))::jsonb,
            'properties', 
              sketches.properties::jsonb || 
              to_jsonb(
                json_build_object(
                  'response_id', sketches.response_id, 
                  'name', sketches.name, 
                  'area_sq_meters', round(st_area(coalesce(sketches.geom, sketches.user_geom)::geography)),
                  'response_data', survey_responses.data::json->fid::text
                )
              )
          ))
        ) 
        FROM sketches
        INNER JOIN survey_responses
        ON survey_responses.id = sketches.response_id
        where form_element_id = fid 
        into output;
        return output;
    else 
      raise exception 'Not authorized';
    end if;
    end;
  $$;
