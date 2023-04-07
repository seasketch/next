--! Previous: sha1:47df3314f3f45f97fac756a42c1dfaba57b6016b
--! Hash: sha1:1e263def1de1f9e01646315f9929630c7d6adb11

-- Enter migration here
CREATE OR REPLACE FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) RETURNS public.access_control_lists
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      pid int;
      acl access_control_lists;
    BEGIN
      select project_id into pid from access_control_lists where id = "aclId";
      if session_is_admin(pid) then
        insert into access_control_list_groups (access_control_list_id, group_id) values ("aclId", "groupId") on conflict do nothing;
      else
        raise exception 'Must be an administrator';
      end if;
      select * into acl from access_control_lists where id = "aclId";
      return acl;
    END
  $$;
