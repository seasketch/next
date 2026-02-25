--! Previous: sha1:452069702713b602d3b4e23f99301126673142cd
--! Hash: sha1:c1d6745848b06d2f78d8dd595a4eb2fd0a0d8bc1

-- Enter migration here
create or replace function project_geography_sketch_classes(geography project_geography)
returns setof sketch_classes
language sql
security definer
stable
as $$
  select * from sketch_classes where id in (select sketch_class_id from sketch_class_geographies where geography_id = geography.id);
$$;

comment on function project_geography_sketch_classes is '@simpleCollections only';
grant execute on function project_geography_sketch_classes to anon;
