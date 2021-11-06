--! Previous: sha1:bf71314cb44ba87f62f99d9d6205b9088deb2e40
--! Hash: sha1:fa5cd72dec96488ba9549c5c7e9de6605755887b

-- Enter migration here
delete from form_element_types where component_name = 'MultipleChoice';
insert into form_element_types (component_name, label, is_input) values ('MultipleChoice', 'Multiple Choice', true);
