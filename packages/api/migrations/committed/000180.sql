--! Previous: sha1:00fcfeb2c9acc95dc3a81176340afd414f806d5e
--! Hash: sha1:b0d892e00b7ca23f95a15fa296890f7a6906c892

-- Enter migration here
set role postgres;
create or replace function create_sketch_class_from_template("projectId" int, template_sketch_class_id int)
  returns sketch_classes
  language plpgsql
  security definer
  as $$
    declare 
      base sketch_classes;
      created sketch_classes;
      num_similarly_named int;
      new_name text;
    begin
      if session_is_admin("projectId") then
        select * into base from sketch_classes where id = template_sketch_class_id;
        if base is null then
          raise exception 'Sketch Class with id=% does not exist', template_sketch_class_id;
        end if;
        if base.is_template = false then
          raise exception 'Sketch Class with id=% is not a template', template_sketch_class_id;
        end if;
        -- TODO: add suffix to name if there are duplicates
        select count(*) into num_similarly_named from sketch_classes where project_id = "projectId" and form_element_id is null and name ~ (base.name || '( \(\d+\))?');
        new_name = base.name;
        if num_similarly_named > 0 then
          new_name = new_name || ' (' || num_similarly_named::text || ')';
        end if;
        insert into sketch_classes (project_id, name, geometry_type, allow_multi, geoprocessing_project_url, geoprocessing_client_name, geoprocessing_client_url, mapbox_gl_style) values ("projectId", new_name, base.geometry_type, base.allow_multi, base.geoprocessing_project_url, base.geoprocessing_client_name, base.geoprocessing_client_url, base.mapbox_gl_style) returning * into created;
        perform initialize_sketch_class_form_from_template(created.id, (select id from forms where sketch_class_id = base.id));
        return created;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

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
  'LINESTRING',
  '{}'::jsonb,
  true,
  'Basic named linestring feature with no additional attributes.'
);

select initialize_sketch_class_form_from_template((select id from sketch_classes where name = 'Simple Line' and is_template = true), (select id from forms where is_template = true and template_type = 'SKETCHES' and template_name = 'Basic Template'));

delete from sketch_classes where project_id = (select id from projects where slug = 'superuser') and name = 'Marine Protected Area';
insert into sketch_classes(project_id, name, geometry_type, mapbox_gl_style, is_template, template_description) values (
  (select id from projects where slug = 'superuser'),
  'Marine Protected Area',
  'POLYGON',
  '{}'::jsonb,
  true,
  'Polygons that are clipped to shoreline, symbolized by designation, and include an example report.'
);

select initialize_sketch_class_form_from_template((select id from sketch_classes where name = 'Marine Protected Area' and is_template = true), (select id from forms where is_template = true and template_type = 'SKETCHES' and template_name = 'Basic Template'));
set role postgres;
