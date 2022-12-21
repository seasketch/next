--! Previous: sha1:31ebf39c394df165adb65e597edc4d3ead4f92ff
--! Hash: sha1:d6a2a6858ab32bc88c932d447ff670589653c665

-- Enter migration here
CREATE OR REPLACE FUNCTION public.sketch_as_geojson(id integer) RETURNS jsonb
    LANGUAGE sql
    AS $$
    SELECT jsonb_build_object(
      'type', 'Feature',
      'id',         sketches.id,
      'geometry',   ST_AsGeoJSON(coalesce(geom, user_geom))::jsonb,
      'bbox', sketches.bbox,
      'properties', sketches_geojson_properties(sketches.*)
    ) 
    FROM sketches
    where sketches.id = sketch_as_geojson.id;
$$;
