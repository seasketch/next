--! Previous: sha1:69255ad304c205eab43cd0db6d0193bc403b8f8a
--! Hash: sha1:6d0e0ecb4eb8cbce2e864dce288208def90f03d1

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


-- Then all polygons missing a style
update sketch_classes set mapbox_gl_style = '[{"type":"fill","paint":{"fill-color":"#f28e2c","fill-opacity":0.6},"layout":{}},{"type":"line","paint":{"line-color":"#f28e2c","line-width":2},"layout":{}}]' where geometry_type = 'POLYGON' and mapbox_gl_style is null;
update sketch_classes set mapbox_gl_style = '[{"type":"fill","paint":{"fill-color":"#f28e2c","fill-opacity":0.6},"layout":{}},{"type":"line","paint":{"line-color":"#f28e2c","line-width":2},"layout":{}}]' where geometry_type = 'POLYGON' and mapbox_gl_style = '{}'::jsonb;

-- Then all points missing a style
update sketch_classes set mapbox_gl_style = '[{"type":"circle","paint":{"circle-color":"#fb9b2d","circle-radius":5,"circle-opacity":0.5,"circle-stroke-color":"#ff822e","circle-stroke-width":1},"layout":{}}]' where geometry_type = 'POINT' and mapbox_gl_style is null;
update sketch_classes set mapbox_gl_style = '[{"type":"circle","paint":{"circle-color":"#fb9b2d","circle-radius":5,"circle-opacity":0.5,"circle-stroke-color":"#ff822e","circle-stroke-width":1},"layout":{}}]' where geometry_type = 'POINT' and mapbox_gl_style = '{}'::jsonb;

-- Then all lines missing a style
update sketch_classes set mapbox_gl_style = '[{"type":"line","paint":{"line-color":"#ffffff","line-width":4},"layout":{"line-cap":"round"}},{"type":"line","paint":{"line-color":"#ff9d14","line-width":2},"layout":{}}]' where geometry_type = 'LINESTRING' and mapbox_gl_style is null;
update sketch_classes set mapbox_gl_style = '[{"type":"line","paint":{"line-color":"#ffffff","line-width":4},"layout":{"line-cap":"round"}},{"type":"line","paint":{"line-color":"#ff9d14","line-width":2},"layout":{}}]' where geometry_type = 'LINESTRING' and mapbox_gl_style = '{}'::jsonb;

-- Then add a constraint to make sure gl style is set for all polygon, point, and line sketches
alter table sketch_classes drop constraint if exists sketch_classes_mapbox_gl_style_not_null;
alter table sketch_classes add constraint sketch_classes_mapbox_gl_style_not_null check (mapbox_gl_style is not null or geometry_type not in ('POLYGON', 'POINT', 'LINESTRING'));
