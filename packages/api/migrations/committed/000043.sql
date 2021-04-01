--! Previous: sha1:b1dc277cde4c9f4632c3a706b74df9d9a02d7717
--! Hash: sha1:e81a08d217fbe8c6d40094ae3c537b4c17e363ae

-- Enter migration here
CREATE OR REPLACE FUNCTION public.projects_data_hosting_quota_used(p public.projects) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
    if sum_bytes is null then
      return 0;
    end if;
    return quota;
    end;
  $$;
