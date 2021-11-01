--! Previous: sha1:f8bc6080ec12466dd2811c99d9f58d4adbf7f59f
--! Hash: sha1:f89470a3a2db3bea5bbb4afba82bc81691d7337f

-- Enter migration here
delete from form_element_types where component_name = 'ThankYou';
insert into form_element_types (component_name, label, is_input, is_surveys_only, is_required_for_surveys, is_hidden) values ('ThankYou', 'Thank You', false, true, true, true);

update form_element_types set is_hidden = true where component_name = 'WelcomeMessage';
