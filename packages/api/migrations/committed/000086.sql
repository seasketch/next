--! Previous: sha1:a6febd52bcd2dd879fb0e2ee56aea8e5a248216e
--! Hash: sha1:bd16e9cd3112a9dd9bd7c871d0d4b64efe797fde

-- Enter migration here
delete from form_element_types where component_name = 'Statement';
insert into form_element_types (component_name, label, is_input) values ('Statement', 'Statement', false);
