-- Enter migration here
alter table sketch_classes add column if not exists filter_api_version int not null default 1;
alter table sketch_classes add column if not exists filter_api_server_location text;

alter type sketch_geometry_type add value if not exists 'FILTERED_PLANNING_UNITS';

set role seasketch_superuser;
delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'Filtered Planning Units';

insert into sketch_classes(
  project_id, 
  name, 
  geometry_type, 
  mapbox_gl_style, 
  is_template, 
  template_description
) values (
  (select id from projects where slug = 'superuser'),
  'Filtered Planning Units',
  'FILTERED_PLANNING_UNITS'::sketch_geometry_type,
  '{}'::jsonb,
  true,
  'Filter polygons by criteria. Requires an API server.'
) on conflict do nothing;

select initialize_sketch_class_form_from_template((select id from sketch_classes where name = 'Filtered Planning Units' and is_template = true), (select id from forms where is_template = true and template_type = 'SKETCHES' and template_name = 'Basic Template'));
set role postgres;

GRANT update (filter_api_server_location) on sketch_classes to seasketch_user;
GRANT update (filter_api_version) on sketch_classes to seasketch_user;

delete from form_element_types where component_name = 'FilterInput';
insert into form_element_types (
  component_name,
  label,
  is_input,
  is_surveys_only
) values (
  'FilterInput',
  'Filter Input',
  true,
  false
);
