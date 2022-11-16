--! Previous: sha1:abdf661a39e6a3968e11dcd711bd32c0865395cf
--! Hash: sha1:00fcfeb2c9acc95dc3a81176340afd414f806d5e

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

delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'Simple Polygon';
insert into sketch_classes(project_id, name, geometry_type, mapbox_gl_style, is_template, template_description) values (
  (select id from projects where slug = 'superuser'),
  'Simple Polygon',
  'POLYGON',
  '{}'::jsonb,
  true,
  'Basic named polygon feature with no additional attributes.'
);

select initialize_sketch_class_form_from_template((select id from sketch_classes where name = 'Simple Polygon' and is_template = true), (select id from forms where is_template = true and template_type = 'SKETCHES' and template_name = 'Basic Template'));


delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'Simple Line';
insert into sketch_classes(project_id, name, geometry_type, mapbox_gl_style, is_template, template_description) values (
  (select id from projects where slug = 'superuser'),
  'Simple Line',
  'POINT',
  '{}'::jsonb,
  true,
  'Basic named linestring feature with no additional attributes.'
);

select initialize_sketch_class_form_from_template((select id from sketch_classes where name = 'Simple Line' and is_template = true), (select id from forms where is_template = true and template_type = 'SKETCHES' and template_name = 'Basic Template'));
set role postgres;
