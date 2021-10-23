--! Previous: sha1:67e3630324492e7a6b391a7cdfb888814911a355
--! Hash: sha1:f05725302023bf49b0fffcea9aefde206b731afa

-- Enter migration here
delete from form_element_types where component_name = 'Rating';
insert into form_element_types (component_name, label, is_input) values ('Rating', 'Rating', true);
