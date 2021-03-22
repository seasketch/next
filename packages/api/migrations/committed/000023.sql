--! Previous: sha1:abb03e2cb26cae081514482d9ecb6df6961f91c9
--! Hash: sha1:00a45cfca76013eea06ea6d96943eff01061025a

-- Enter migration here
alter table projects
  drop constraint if exists name_min_length;
alter table projects
  add constraint name_min_length check (length(name) >= 4);

alter table projects drop constraint if exists projects_logo_url_check;
alter table projects drop constraint if exists projects_logo_link_check;
alter table projects drop column if exists region;
alter table projects add column region geometry(polygon) default ST_geomfromGeoJSON('{"coordinates":[[[-157.05324470015358,69.74201326987497],[135.18377661193057,69.74201326987497],[135.18377661193057,-43.27449014737426],[-157.05324470015358,-43.27449014737426],[-157.05324470015358,69.74201326987497]]],"type":"Polygon"}') not null;

GRANT UPDATE(region) ON TABLE public.projects TO seasketch_superuser;
GRANT UPDATE(region) ON TABLE public.projects TO seasketch_user;

grant execute on function postgis_type_name to anon;
grant execute on function st_coorddim to anon;
grant execute on function geometry(geometry, integer, boolean) to anon;
grant execute on function geometry(box2d) to anon;
grant execute on function geometry(box3d) to anon;
grant execute on function geometry(polygon) to anon;
grant execute on function geometry(text) to anon;
grant execute on function text(geometry) to anon;
grant execute on function st_srid(geometry) to anon;
grant execute on function st_srid(geography) to anon;
grant execute on function st_asgeojson(geography, integer, integer) to anon;
grant execute on function st_asgeojson(geometry, integer, integer) to anon;
