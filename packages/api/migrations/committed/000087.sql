--! Previous: sha1:bd16e9cd3112a9dd9bd7c871d0d4b64efe797fde
--! Hash: sha1:25e2a89106ebe7da5d37c5d27cc67005a9f28f65

-- Enter migration here

alter table form_element_types add column if not exists advances_automatically boolean not null default false;
delete from form_element_types where component_name = 'YesNo';
insert into form_element_types (component_name, label, is_input, advances_automatically) values ('YesNo', 'Yes/No', true, true);

grant select (advances_automatically) on form_element_types to anon;
