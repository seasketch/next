--! Previous: sha1:563ade500e1b50ea065d38bbdd96df4a4b50f173
--! Hash: sha1:40ccd2702d9e56cbd75cba6b10c0f0980c014dd8

-- Enter migration here
CREATE OR REPLACE FUNCTION forums_can_post(forum forums) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    with acl as (
      select id, type, project_id from access_control_lists where forum_id_write = forum.id
    )
    select 
      ((
        exists(select 1 from acl where type = 'public') or 
        (
          exists(select 1 from acl where type = 'group') and 
          current_setting('session.user_id', TRUE) != '' and 
          exists (
            select 1 from access_control_list_groups 
              where access_control_list_id = (select id from acl) and group_id in (
                select group_id from project_group_members where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer
              )
          )
        )
      ) or session_is_admin((select project_id from acl))) and current_setting('session.user_id', TRUE) != '';
  $$;
