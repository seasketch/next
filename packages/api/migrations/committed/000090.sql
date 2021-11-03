--! Previous: sha1:f89470a3a2db3bea5bbb4afba82bc81691d7337f
--! Hash: sha1:fc09026c9ea0b63a1add0cc2ebd638831f57b23c

-- Enter migration here
delete from form_element_types where component_name = 'Name';
insert into form_element_types (component_name, label, is_input, is_surveys_only, is_single_use_only) values ('Name', 'Name', true, true, true);

update form_element_types set is_single_use_only = true where component_name = 'ThankYou';
update form_element_types set is_single_use_only = true where component_name = 'Email';
alter table surveys add column if not exists show_facilitation_option boolean not null default true;
