--! Previous: sha1:5273cee724a348faf796d7182414b2521afb9183
--! Hash: sha1:3f9e714d9e247240dffdbfc4f2d80b244bb9630f

-- Enter migration here
drop function if exists sketch_classes_geographies(sketch_classes);
grant select on project_geography to anon;
grant select on sketch_class_geographies to anon;
comment on table sketch_class_geographies is '@omit';
