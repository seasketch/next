--! Previous: sha1:25e2a89106ebe7da5d37c5d27cc67005a9f28f65
--! Hash: sha1:f8bc6080ec12466dd2811c99d9f58d4adbf7f59f

-- Enter migration here
delete from form_element_types where component_name = 'TextArea';
insert into form_element_types (component_name, label, is_input) values ('TextArea', 'Text Area', true);
