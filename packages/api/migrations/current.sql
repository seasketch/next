-- Enter migration here
drop type if exists extended_geostats_type cascade;
create type extended_geostats_type as enum (
  'string',
  'number',
  'boolean',
  'null',
  'mixed',
  'array',
  'object'
);

alter table form_element_types add column if not exists geostats_type extended_geostats_type default null;
alter table form_element_types add column if not exists geostats_array_of extended_geostats_type default null;

update form_element_types set geostats_type = 'string' where component_name = 'ShortText';
update form_element_types set geostats_type = 'string' where component_name = 'TextArea';
update form_element_types set geostats_type = 'string' where component_name = 'Name';
update form_element_types set geostats_type = 'string' where component_name = 'Email';
update form_element_types set geostats_type = 'number' where component_name = 'Rating';
update form_element_types set geostats_type = 'number' where component_name = 'Number';
update form_element_types set geostats_type = 'boolean' where component_name = 'YesNo';
update form_element_types set geostats_type = 'string' where component_name = 'ComboBox';
update form_element_types set geostats_type = 'array' where component_name = 'MultipleChoice';
update form_element_types set geostats_array_of = 'string' where component_name = 'MultipleChoice';
update form_element_types set geostats_type = 'string' where component_name = 'FeatureName';
update form_element_types set geostats_type = 'number' where component_name = 'SAPRange';
update form_element_types set geostats_type = 'number' where component_name = 'ParticipantCount';


