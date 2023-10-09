--! Previous: sha1:f52aac9ba95f7076ef8f62f2341b81ce979e18ba
--! Hash: sha1:16db90df4dc18767a3f092f7846df55e23dae257

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
