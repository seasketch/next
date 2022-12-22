--! Previous: sha1:795081ed4e5a737cd93e640b3943266d92a86384
--! Hash: sha1:11d2b3bee1ca632120c91e69eec19564a1a4c9bb

-- Enter migration here
set role seasketch_superuser;
delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'Collection';
insert into sketch_classes(project_id, name, geometry_type, mapbox_gl_style, is_template, template_description) values (
  (select id from projects where slug = 'superuser'),
  'Collection',
  'COLLECTION',
  '{}'::jsonb,
  true,
  'Used to evaluate a set of zones. For representing designs such as Marine Protected Area Networks.'
);

select initialize_sketch_class_form_from_template((select id from sketch_classes where name = 'Collection' and is_template = true), (select id from forms where is_template = true and template_type = 'SKETCHES' and template_name = 'Basic Template'));

delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'Simple Point';

set role postgres;
