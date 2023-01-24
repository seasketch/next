--! Previous: sha1:9e119f25972d935fc756caf683106ef3eda95321
--! Hash: sha1:2625e85cb8ef2b588685b85596c2fa7a540f228b

-- Enter migration here

CREATE OR REPLACE FUNCTION public.session_on_acl(acl_id integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    with acl as (
      select type, project_id from access_control_lists where id = acl_id
    )
    select exists(select 1 from acl where type = 'public') or
    session_is_admin((select project_id from access_control_lists where id = acl_id)) or
    (
      exists(select 1 from acl where type = 'group') and 
      current_setting('session.user_id', TRUE) != '' and 
      -- current_setting('session.email_verified', true) = 'true' and
      exists (
        select 1 from access_control_list_groups 
          where access_control_list_id = acl_id and group_id in (
            select group_id from project_group_members where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer
          )
      )
    )
  $$;
