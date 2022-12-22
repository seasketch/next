--! Previous: sha1:d6a2a6858ab32bc88c932d447ff670589653c665
--! Hash: sha1:15f180becc2f4e2e4b90da55f165a25a44dcd718

-- Enter migration here
CREATE OR REPLACE FUNCTION public.sketches_geojson_properties(sketch public.sketches) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    select jsonb_build_object(
            'id', sketches.id::text,
            'userId', sketches.user_id::text, 
            'createdAt', sketches.created_at,
            'updatedAt', sketches.updated_at,
            'sketchClassId', sketches.sketch_class_id::text,
            'user_slug', coalesce(nullif(user_profiles.nickname, ''), nullif(user_profiles.fullname, ''), nullif(user_profiles.email, '')),
            'collectionId', sketches.collection_id::text, 
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
