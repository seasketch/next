--! Previous: sha1:408264ea11b4051d04b883910686332db7f64e8c
--! Hash: sha1:b693850cdbccea8615730666795e5531b669d0cb

-- Enter migration here
CREATE or replace FUNCTION public.sketch_as_geojson(id integer) RETURNS jsonb
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
            'created_at', sketches.created_at,
            'user_slug', coalesce(nullif(user_profiles.nickname, ''), nullif(user_profiles.fullname, ''), nullif(user_profiles.email, '')),
            'collection_id', sketches.collection_id, 
            'name', sketches.name
          )
        )
    ) 
    FROM sketches
    inner join user_profiles
    on user_profiles.user_id = sketches.user_id
    where sketches.id = sketch_as_geojson.id 
    into output;
    return output;
  end;
$$;

alter table sketches add column if not exists created_at timestamptz not null default now();
alter table sketches add column if not exists updated_at timestamptz not null default now();

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp on sketches;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON sketches
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
