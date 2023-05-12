--! Previous: sha1:6a80ab7c8b7c4b224036c29b51b4af88caeac218
--! Hash: sha1:f52aac9ba95f7076ef8f62f2341b81ce979e18ba

-- Enter migration here
set role seasketch_superuser;
delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'Simple Point';

insert into sketch_classes(project_id, name, geometry_type, mapbox_gl_style, is_template, template_description) values (
  (select id from projects where slug = 'superuser'),
  'Simple Point',
  'POINT',
  '{}'::jsonb,
  true,
  'Basic named point feature with no additional attributes.'
);
select initialize_sketch_class_form_from_template((select id from sketch_classes where name = 'Simple Point' and is_template = true), (select id from forms where is_template = true and template_type = 'SKETCHES' and template_name = 'Basic Template'));
set role postgres;
