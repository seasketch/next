--! Previous: sha1:0ead82003f7ee6c0c596ec297611e7755bf70ff4
--! Hash: sha1:2eb051515b9cb2e5f07b25917df69bf0c664906f

-- Enter migration here
drop function if exists label_for_form_element_value;
CREATE OR REPLACE FUNCTION label_for_form_element_value(attr_value jsonb, component_settings jsonb)
  returns jsonb
  language plpgsql
  as $$
    BEGIN
      if component_settings is not null and component_settings ? 'options' then
        if jsonb_typeof(attr_value) = 'array' then
          -- return null;
          return (select to_jsonb(array(
            select (select to_jsonb(label) from 
            jsonb_to_recordset(component_settings->'options') as f(label text, value text)
            where f.value = foo.* #>> '{}')
            from jsonb_array_elements(attr_value) as foo
          )));
        elsif jsonb_typeof(attr_value) = 'string' then
          raise notice 'is string. %', attr_value;
          return (select to_jsonb(label) from 
            jsonb_to_recordset(component_settings->'options') as f(label text, value text)
            where f.value = attr_value #>> '{}');
        end if;
      end if;
      return null;
    END
  $$;

grant execute on function label_for_form_element_value to anon;

drop function if exists alternate_language_labels_for_form_element;
create or replace function alternate_language_labels_for_form_element(attr_id int, attr_value jsonb, alternate_language_settings jsonb)
  returns jsonb
  language plpgsql
  as $$
    DECLARE
      lang   text;
      _value text;
      output jsonb := jsonb_build_object();
    BEGIN
      FOR lang, _value IN
      SELECT * FROM jsonb_each(alternate_language_settings)
    LOOP
      if alternate_language_settings->lang is not null and (alternate_language_settings->lang ? 'body' or alternate_language_settings->lang ? 'options') then
        output := output || 
          jsonb_build_object(
            lang, jsonb_build_object(
              'label', case when alternate_language_settings->lang ? 'body' then generate_label(attr_id, alternate_language_settings->lang->'body') else null end,
              'valueLabel', label_for_form_element_value(attr_value, alternate_language_settings->lang)
            )
          );
      end if;
    END LOOP;
    return output;
    END
  $$;

grant execute on function alternate_language_labels_for_form_element to anon;

CREATE OR REPLACE FUNCTION public.sketches_user_attributes(sketch public.sketches) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
    select jsonb_agg(jsonb_build_object(
      'label', form_elements.generated_label,
      'value', sketch.properties->form_elements.id::text,
      'valueLabel', label_for_form_element_value(sketch.properties->form_elements.id::text, form_elements.component_settings),
      'exportId', form_elements.generated_export_id,
      'fieldType', form_elements.type_id,
      'alternateLanguages', alternate_language_labels_for_form_element(form_elements.id, sketch.properties->form_elements.id::text, form_elements.alternate_language_settings)
    )) from form_elements where form_id = (
      select id from forms where sketch_class_id = sketch.sketch_class_id
    ) and type_id != 'FeatureName';
  $$;
