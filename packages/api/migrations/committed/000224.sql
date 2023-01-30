--! Previous: sha1:b9b45afa60d466397e8a3729e1920a303549adb2
--! Hash: sha1:35c99796dc079146bf916f8f41451a031ede5e21

-- Enter migration here
CREATE OR REPLACE FUNCTION public.sketches_child_properties(sketch public.sketches) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    security definer
    AS $$
    declare
      output jsonb;
    begin
      if (select is_collection(sketch_class_id) from sketches where id = sketch.id) then
        select jsonb_agg(sketches_geojson_properties(sketches.*)) into output from sketches where id = any(
          (select unnest(get_child_sketches_recursive(sketch.id, 'sketch')))
        );
      end if;
      return output;
    end;
  $$;
