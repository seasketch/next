--! Previous: sha1:ac0d81a214bb555fa312646e96d225a6dc56f0a8
--! Hash: sha1:70958ca0af527ee54ead2c6d90a6ef72f103f6c9

-- Enter migration here
ALTER TABLE form_elements DROP CONSTRAINT form_fields_component_settings_check;
ALTER TABLE form_elements ADD CONSTRAINT form_fields_component_settings_check CHECK ((char_length((component_settings)::text) < 200000));
