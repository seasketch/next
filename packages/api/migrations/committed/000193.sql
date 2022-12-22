--! Previous: sha1:40320028379029cf90d5ef229f2ec8fa542976b4
--! Hash: sha1:53bb7c7048f37a43ae0cb6d316476a3a74078596

-- Enter migration here
CREATE OR REPLACE FUNCTION public.sketches_geojson_properties(sketch public.sketches) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    select sketches.properties || jsonb_build_object(
            'userId', sketches.user_id, 
            'createdAt', sketches.created_at,
            'updatedAt', sketches.updated_at,
            'sketchClassId', sketches.sketch_class_id,
            'user_slug', coalesce(nullif(user_profiles.nickname, ''), nullif(user_profiles.fullname, ''), nullif(user_profiles.email, '')),
            'collectionId', sketches.collection_id, 
            'isCollection', (select geometry_type = 'COLLECTION' from sketch_classes where id = sketches.sketch_class_id),
            'name', sketches.name,
            'userAttributes', (
              select array_agg(jsonb_build_object(
                'label', form_elements.generated_label,
                'value', sketches.properties->form_elements.id::text,
                'exportId', form_elements.generated_export_id,
                'fieldType', form_elements.type_id
              )) from form_elements where form_id = (
                select id from forms where sketch_class_id = sketches.sketch_class_id
              )
            )
          ) || (
            select 
              jsonb_object_agg(generated_export_id, sketches.properties->form_elements.id::text) 
              from form_elements 
              where form_id = (
                select id from forms where sketch_class_id = sketches.sketch_class_id
              )
          ) 
    from sketches
    inner join user_profiles
    on user_profiles.user_id = sketches.user_id
    where sketches.id = sketch.id;
  $$;
