--! Previous: sha1:8af51f902029b1256157f1d0635e62c903db1d2a
--! Hash: sha1:f70eda103831679bb4538fe4b6377802b2fb262d

-- Enter migration here
CREATE OR REPLACE FUNCTION sketch_as_geojson(id integer) RETURNS jsonb
    LANGUAGE plpgsql 
    AS $$
  declare
    output jsonb;
  begin
    SELECT json_build_object(
      'type', 'Feature',
      'type',       'Feature',
      'id',         sketches.id,
      'geometry',   ST_AsGeoJSON(coalesce(geom, user_geom))::jsonb,
      'bbox', sketches.bbox,
      'properties', 
        sketches.properties::jsonb || 
        to_jsonb(
          json_build_object(
            'user_id', sketches.user_id, 
            'collection_id', sketches.collection_id, 
            'name', sketches.name
          )
        )
    ) 
    FROM sketches
    where sketches.id = sketch_as_geojson.id 
    into output;
    return output;
  end;
$$;

grant execute on function sketch_as_geojson to anon;
grant execute on function st_area(geometry) to anon;
grant execute on function st_area(text) to anon;
grant execute on function st_area(geography, boolean) to anon;
grant execute on function geography(bytea) to anon;
grant execute on function geography(geography, integer, boolean) to anon;
grant execute on function geography(geometry) to anon;
