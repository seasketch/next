--! Previous: sha1:a5546bb7ff03e133021ddc98211ba6f7790b0940
--! Hash: sha1:876f1112f11d2825911ac6e0af74eca65824315b

-- Enter migration here
grant update(mapbox_secret_key) on projects to seasketch_user;
grant select(mapbox_secret_key) on projects to seasketch_user;
comment on column projects.mapbox_secret_key is '
@omit
';

drop function if exists update_mapbox_secret_key;
COMMENT ON FUNCTION projects_mapbox_secret_key IS E'@fieldName mapboxSecretKey';
create or replace function update_mapbox_secret_key(project_id int, secret text)
  returns projects
  language plpgsql
  security definer
  as $$
    declare
      p projects;
    begin
      if session_is_admin(project_id) then
        update projects set mapbox_secret_key = secret where projects.id = project_id returning * into p;
        return p;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function update_mapbox_secret_key to seasketch_user;
