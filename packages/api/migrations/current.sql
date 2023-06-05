-- Enter migration here
delete from form_element_types where component_name = 'ParticipantCount';
insert into form_element_types (
  component_name,
  label,
  is_input,
  is_surveys_only,
  is_single_use_only
) values (
  'ParticipantCount',
  'Participant Count',
  true,
  true,
  true
);

delete from form_element_types where component_name = 'DemographicChoice';
insert into form_element_types (
  component_name,
  label,
  is_input,
  is_surveys_only
) values (
  'DemographicChoice',
  'Demographic Choice',
  true,
  true
);