--! Previous: sha1:a4054c704743dde758754f94225f8538193f2ec0
--! Hash: sha1:ca6ecb7392982b4cf2f34945540f9eb4c72d8c6b

-- Enter migration here
delete from form_element_types where component_name = 'Matrix';
insert into form_element_types (
  component_name,
  label,
  is_input
) values (
  'Matrix',
  'Matrix',
  true
);
