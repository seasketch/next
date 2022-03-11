--! Previous: sha1:ee93c93851c760e7e7f66034918f0c197c04b03c
--! Hash: sha1:3db4c97330bfc9e52ab33cedb3946ab7d2432820

-- Enter migration here
-- alter table projects add column if not exists mapbox_public_key text;
alter table projects drop column if exists mapbox_secret_key;
alter table projects drop column if exists mapbox_public_key;
alter table projects add column if not exists mapbox_secret_key text CONSTRAINT is_secret CHECK (mapbox_secret_key is null or mapbox_secret_key ~* '^sk\..+');
alter table projects add column if not exists mapbox_public_key text CONSTRAINT is_public_key CHECK (mapbox_public_key is null or mapbox_public_key ~* '^pk\..+');

revoke select(mapbox_secret_key) on projects from anon;

create or replace function projects_mapbox_secret_key(project projects)
  returns text
  language sql
  security definer
  stable
  as $$
    select mapbox_secret_key from projects where projects.id = project.id and session_is_admin(project.id);
  $$;

comment on function projects_mapbox_secret_key is 'Only available to project admins. Use to query basemaps from a specified account.';

grant update (mapbox_public_key) on projects to seasketch_user;
grant update (mapbox_secret_key) on projects to seasketch_user;
