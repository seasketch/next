--! Previous: sha1:a4dfe0c8b3e916dcd11e60980df8f7e19b66a7bd
--! Hash: sha1:5273cee724a348faf796d7182414b2521afb9183

-- Enter migration here
alter table sketch_classes add column if not exists is_geography_clipping_enabled boolean not null default false;

-- add a many to many table for relating sketch classes to geographies
create table if not exists sketch_class_geographies (
    sketch_class_id integer not null references sketch_classes(id),
    geography_id integer not null references project_geography(id),
    primary key (sketch_class_id, geography_id)
);

create index if not exists sketch_class_geographies_sketch_class_id_idx on sketch_class_geographies (sketch_class_id);
create index if not exists sketch_class_geographies_geography_id_idx on sketch_class_geographies (geography_id);

revoke select on sketch_class_geographies from anon;

grant select on project_geography to anon;


-- add a mutation function
create or replace function update_sketch_class_geographies(sketch_class_id integer, geography_ids integer[])
  returns sketch_classes
  language plpgsql
  security definer
  as $$
    declare
      sketch_class sketch_classes;
    begin
    if session_is_admin((select project_id from sketch_classes where id = sketch_class_id)) then
      delete from sketch_class_geographies where sketch_class_geographies.sketch_class_id = update_sketch_class_geographies.sketch_class_id;
      insert into sketch_class_geographies (sketch_class_id, geography_id) values (sketch_class_id, unnest(geography_ids));
      select * into sketch_class from sketch_classes where id = update_sketch_class_geographies.sketch_class_id;
      return sketch_class;
    else
      raise exception 'You are not authorized to update the geographies for this sketch class.';
    end if;
    end;
  $$;


grant execute on function update_sketch_class_geographies to seasketch_user;

grant update(is_geography_clipping_enabled) on sketch_classes to seasketch_user;

create index if not exists geography_clipping_layers_project_geography_id_idx on geography_clipping_layers (project_geography_id);


revoke select on table sketch_class_geographies from anon;
revoke select on table sketch_class_geographies from seasketch_user;

create or replace function sketch_classes_geographies(s sketch_classes)
  returns setof project_geography as $$
  select * from project_geography where id in (select geography_id from sketch_class_geographies where sketch_class_id = s.id);
  $$ language sql stable security definer;

grant execute on function sketch_classes_geographies(sketch_classes) to anon;

comment on function sketch_classes_geographies(sketch_classes) is '@simpleCollections only';
