--! Previous: sha1:f05725302023bf49b0fffcea9aefde206b731afa
--! Hash: sha1:7cac77faaed94a99dcd83364f3c971ae21dc03df

-- Enter migration here
delete from form_element_types where component_name = 'Email';
insert into form_element_types (component_name, label, is_input) values ('Email', 'Email', true);
