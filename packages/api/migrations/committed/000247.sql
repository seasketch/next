--! Previous: sha1:2eb051515b9cb2e5f07b25917df69bf0c664906f
--! Hash: sha1:51c6880109b100aa9a2e0bc5ad4352fb95396ea8

-- Enter migration here
CREATE OR REPLACE FUNCTION public.label_for_form_element_value(attr_value jsonb, component_settings jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
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
          return (select to_jsonb(label) from 
            jsonb_to_recordset(component_settings->'options') as f(label text, value text)
            where f.value = attr_value #>> '{}');
        end if;
      end if;
      return null;
    END
  $$;
