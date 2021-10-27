--! Previous: sha1:7cac77faaed94a99dcd83364f3c971ae21dc03df
--! Hash: sha1:a6febd52bcd2dd879fb0e2ee56aea8e5a248216e

-- Enter migration here
delete from form_element_types where component_name = 'Number';
insert into form_element_types (component_name, label, is_input) values ('Number', 'Number', true);
