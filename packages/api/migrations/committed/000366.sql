--! Previous: sha1:40903e02c06538ab9d0ecdfe4c7da9648b475017
--! Hash: sha1:b81788eda4ea1b22925107a27887b27ace367e99

-- Enter migration here
drop function if exists sketch_classes_geographies(sketch_classes);
grant select on project_geography to anon;
grant select on sketch_class_geographies to anon;
comment on table sketch_class_geographies is '@omit';
