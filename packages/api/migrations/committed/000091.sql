--! Previous: sha1:fc09026c9ea0b63a1add0cc2ebd638831f57b23c
--! Hash: sha1:bf71314cb44ba87f62f99d9d6205b9088deb2e40

-- Enter migration here
delete from form_element_types where component_name = 'ComboBox';
insert into form_element_types (component_name, label, is_input) values ('ComboBox', 'Combo Box', true);
