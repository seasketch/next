--! Previous: sha1:24b27fc0756d91d79568081e7f4829d5690d38e2
--! Hash: sha1:31ebf39c394df165adb65e597edc4d3ead4f92ff

-- Enter migration here
create or replace function sketches_child_properties(sketch sketches)
  returns jsonb
  language plpgsql
  stable
  as $$
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

grant execute on function sketches_child_properties to anon;

comment on function sketches_child_properties is 'If the sketch is a collection, includes an array of properties for all sketches that belong to it. These objects will match the `properties` member of the GeoJSON Feature representation of each sketch. This can be passed to report clients in the initialization message.';

CREATE OR REPLACE FUNCTION public.sketches_geojson_properties(sketch public.sketches) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    select jsonb_build_object(
            'id', sketches.id,
            'userId', sketches.user_id, 
            'createdAt', sketches.created_at,
            'updatedAt', sketches.updated_at,
            'sketchClassId', sketches.sketch_class_id,
            'user_slug', coalesce(nullif(user_profiles.nickname, ''), nullif(user_profiles.fullname, ''), nullif(user_profiles.email, '')),
            'collectionId', sketches.collection_id, 
            'isCollection', (select geometry_type = 'COLLECTION' from sketch_classes where id = sketches.sketch_class_id),
            'name', sketches.name,
            'userAttributes', sketches_user_attributes(sketch)) || sketches.properties || (
            select 
              coalesce(jsonb_object_agg(generated_export_id, sketches.properties->form_elements.id::text), '{}'::jsonb)
              from form_elements 
              where form_id = (
                select id from forms where sketch_class_id = sketches.sketch_class_id
              ) and type_id != 'FeatureName'
          ) 
    from sketches
    inner join user_profiles
    on user_profiles.user_id = sketches.user_id
    where sketches.id = sketch.id;
  $$;
