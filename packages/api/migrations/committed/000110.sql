--! Previous: sha1:f1f4cf82373d47ce0df2c9bda194d29effe190c4
--! Hash: sha1:6309162fe5b5db9fe02d42c6885ebc421ada3c35

-- Enter migration here
update form_element_types set supported_operators = '{}' where component_name = 'SpatialAccessPriorityInput';

alter table form_elements add column if not exists subordinate_to int references form_elements(id) on delete cascade;
comment on column form_elements.subordinate_to is '
Used for special elements like SpatialAccessPriorityInput to create a sort of sub-form that the parent element controls the rendering of. Will not appear in the form unless the client implementation utilizes something like FormElement.shouldDisplaySubordinateElement to control visibility.
';
