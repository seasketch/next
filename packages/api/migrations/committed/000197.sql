--! Previous: sha1:9303dd949ddda589082594d22075ec9cc7609ede
--! Hash: sha1:24b27fc0756d91d79568081e7f4829d5690d38e2

-- Enter migration here

CREATE OR REPLACE FUNCTION public.sketches_user_attributes(sketch public.sketches) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    select jsonb_agg(jsonb_build_object(
                'label', form_elements.generated_label,
                'value', sketch.properties->form_elements.id::text,
                'exportId', form_elements.generated_export_id,
                'fieldType', form_elements.type_id
              )) from form_elements where form_id = (
                select id from forms where sketch_class_id = sketch.sketch_class_id
              ) and type_id != 'FeatureName';
  $$;
