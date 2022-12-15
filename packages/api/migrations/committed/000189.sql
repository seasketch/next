--! Previous: sha1:db673bf9042f535bd5b043b66ed076b8be93c274
--! Hash: sha1:5d2269c5bc547bcf2bc04a806a7250b4bf45014a

-- Enter migration here
create or replace function sketches_geojson_properties(sketch sketches)
  returns jsonb
  language sql
  stable
  as $$
    select sketches.properties::jsonb || 
        to_jsonb(
          json_build_object(
            'user_id', sketches.user_id, 
            'created_at', sketches.created_at,
            'user_slug', coalesce(nullif(user_profiles.nickname, ''), nullif(user_profiles.fullname, ''), nullif(user_profiles.email, '')),
            'collection_id', sketches.collection_id, 
            'name', sketches.name
          )
        )
    from sketches
    inner join user_profiles
    on user_profiles.user_id = sketches.user_id
    where sketches.id = sketch.id;
  $$;

grant execute on function sketches_geojson_properties to anon;

CREATE OR REPLACE FUNCTION public.sketch_as_geojson(id integer) RETURNS jsonb
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
      'properties', sketches_geojson_properties(sketches.*)
    ) 
    FROM sketches
    inner join user_profiles
    on user_profiles.user_id = sketches.user_id
    where sketches.id = sketch_as_geojson.id 
    into output;
    return output;
  end;
$$;

CREATE OR REPLACE function sketches_geojson_feature(sketch sketches)
  returns jsonb
  language sql
  stable
  as $$
    select sketch_as_geojson(sketch.id);
  $$;

grant execute on function sketches_geojson_feature to anon;

comment on function sketches_geojson_feature is 'Use this to get a copy of the sketch with properties populated exactly as they would in the geojson or mvt endpoint. Useful for seeding a client-side cache.';
