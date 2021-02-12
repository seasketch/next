-- Enter migration here
create or replace function projects_data_hosting_quota(p projects)
  returns int
  language plpgsql
  security definer
  stable
  as $$
    begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
    return (select 524288000);
    end;
  $$;

grant execute on function projects_data_hosting_quota to seasketch_user;

-- Enter migration here
create or replace function projects_data_hosting_quota_used(p projects)
  returns int
  language plpgsql
  security definer
  stable
  as $$
    declare
      sum_bytes bigint;
      quota int;
    begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
    select sum(byte_length) into sum_bytes from data_sources where project_id = p.id;
    select projects_data_hosting_quota(p) into quota;
    if sum_bytes < quota then
      return sum_bytes;
    end if;
    return quota;
    end;
  $$;

grant execute on function projects_data_hosting_quota_used to seasketch_user;

create or replace function data_hosting_quota_left(pid int)
  returns int
  language sql
  security definer
  stable
  as $$
    select projects_data_hosting_quota(projects.*) - projects_data_hosting_quota_used(projects.*) from projects where id = pid;
  $$;

grant execute on function data_hosting_quota_left to anon;

drop policy if exists data_sources_insert on data_sources;
create policy data_sources_insert on data_sources for insert with check (
  session_is_admin(project_id) and data_hosting_quota_left(project_id) > 0
);

drop policy if exists interactivity_settings_select on interactivity_settings;
drop policy if exists interactivity_settings_read on interactivity_settings;
create policy interactivity_settings_select on interactivity_settings for select using (true);
-- CREATE POLICY interactivity_settings_select ON interactivity_settings USING (session_has_project_access(( SELECT data_layers.project_id
--    FROM public.data_layers
--   WHERE (data_layers.interactivity_settings_id = data_layers.id))));

grant select on interactivity_settings to anon;

-- comment on interactivity_settings is '
-- @omit all
-- @simpleCollection only
-- @omit 
-- ';