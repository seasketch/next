--! Previous: sha1:cbd50fe0e335500477956ad242d1dbe406a36db9
--! Hash: sha1:ff850f07668d6d0984af5cb6488171a28b6f1d9b

-- Enter migration here
revoke select on table sketch_class_geographies from anon;
revoke select on table sketch_class_geographies from seasketch_user;

create or replace function sketch_classes_geographies(s sketch_classes)
  returns setof project_geography as $$
  select * from project_geography where id in (select geography_id from sketch_class_geographies where sketch_class_id = s.id);
  $$ language sql stable security definer;

grant execute on function sketch_classes_geographies(sketch_classes) to anon;

comment on function sketch_classes_geographies(sketch_classes) is '@simpleCollections only';
