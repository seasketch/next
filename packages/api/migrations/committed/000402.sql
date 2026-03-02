--! Previous: sha1:cb7da76a18e46aa5e19cb205f356ce4eb1ea45c5
--! Hash: sha1:6e9a61b9f33abcc6089dff28135ea74f5ae45875

-- Enter migration here
create or replace function sketch_classes_use_geography_clipping(sketch_class sketch_classes)
  returns boolean
  security definer
  stable
  language sql
  as $$
    select sketch_class.is_geography_clipping_enabled and (
      select enable_report_builder from projects where id = sketch_class.project_id
    ) and (
      select count(*) > 0 from sketch_class_geographies where sketch_class_id = sketch_class.id
    );
  $$;

grant execute on function sketch_classes_use_geography_clipping(sketch_classes) to seasketch_user;
