--! Previous: sha1:ab9c34acfe5ecf79d82f7037fa8480c6327c5a86
--! Hash: sha1:cc6a63f22d98395d536f18fea923859d8a49d0de

-- Enter migration here
CREATE OR REPLACE FUNCTION public.sketches_user_attributes(sketch public.sketches) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    select jsonb_agg(jsonb_build_object(
      'formElementId', form_elements.id,
      'label', form_elements.generated_label,
      'value', sketch.properties->form_elements.id::text,
      'valueLabel', label_for_form_element_value(sketch.properties->form_elements.id::text, form_elements.component_settings),
      'exportId', coalesce(form_elements.export_id, form_elements.generated_export_id),
      'fieldType', form_elements.type_id,
      'alternateLanguages', alternate_language_labels_for_form_element(form_elements.id, sketch.properties->form_elements.id::text, form_elements.alternate_language_settings)
    )) from form_elements where form_id = (
      select id from forms where sketch_class_id = sketch.sketch_class_id
    ) and type_id != 'FeatureName';
  $$;
