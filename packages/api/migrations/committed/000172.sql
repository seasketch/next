--! Previous: sha1:93c4237cb9ea16b9ef423006233e4b3b63555ce9
--! Hash: sha1:37308a043ca002cc54230cf8aae031f05c678386

-- Enter migration here

alter table projects add column if not exists data_hosting_quota_big bigint not null default 524288000;
update projects set data_hosting_quota_big = data_hosting_quota;
alter table projects drop column data_hosting_quota;
ALTER TABLE projects RENAME COLUMN data_hosting_quota_big TO data_hosting_quota;
COMMENT ON COLUMN public.projects.data_hosting_quota IS '@omit';

drop function if exists public.projects_data_hosting_quota;
CREATE or replace FUNCTION public.projects_data_hosting_quota(p public.projects) RETURNS bigint
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
    return (select data_hosting_quota from projects where id = p.id);
    end;
  $$;

grant execute on function projects_data_hosting_quota to seasketch_user;

--
-- Name: projects_data_hosting_quota_used(public.projects); Type: FUNCTION; Schema: public; Owner: -
--
drop function if exists projects_data_hosting_quota_used;
CREATE or replace FUNCTION public.projects_data_hosting_quota_used(p public.projects) RETURNS bigint
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      sum_bytes bigint;
      quota bigint;
    begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
    select sum(byte_length) into sum_bytes from data_sources where project_id = p.id;
    select projects_data_hosting_quota(p) into quota;
    if sum_bytes < quota then
      return sum_bytes;
    end if;
    if sum_bytes is null then
      return 0;
    end if;
    return quota;
    end;
  $$;

grant execute on function projects_data_hosting_quota_used to seasketch_user;

CREATE OR REPLACE FUNCTION public.create_data_upload(filename text, project_id integer, content_type text) RETURNS public.data_upload_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      upload data_upload_tasks;
      used bigint;
      quota bigint;
    begin
      if session_is_admin(project_id) then
        select projects_data_hosting_quota_used(projects.*), projects_data_hosting_quota(projects.*) into used, quota from projects where id = project_id;
        if quota - used > 0 then
          insert into data_upload_tasks(project_id, filename, content_type, user_id) values (create_data_upload.project_id, create_data_upload.filename, create_data_upload.content_type, nullif(current_setting('session.user_id', TRUE), '')::integer) returning * into upload;
          return upload;
        else
          raise exception 'data hosting quota exceeded';
        end if;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;
