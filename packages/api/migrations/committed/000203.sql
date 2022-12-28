--! Previous: sha1:c9154ab59aa6361af7982b363a381f65dc83b279
--! Hash: sha1:46c1a39b0ff7490a6ffa437792585e31bfff144b

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
            'userSlug', coalesce(nullif(user_profiles.nickname, ''), nullif(user_profiles.fullname, ''), nullif(user_profiles.email, '')),
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
