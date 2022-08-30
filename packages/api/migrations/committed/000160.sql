--! Previous: sha1:e8ea97ce8262aaa3b9ca1cc62962191b5298839f
--! Hash: sha1:37463c2e2e71faeb884d8bd2ae2cb2c57f4be730

-- Enter migration here
create or replace function projects_session_has_privileged_access(p projects)
  returns boolean
  language sql
  stable
  security definer
  as $$
    select exists (
      select project_id from project_participants where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer and project_id = p.id and is_admin = true
    ) or (
      select count(*) > 0 from project_group_members where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer and project_group_members.group_id in (select id from project_groups where project_id = p.id)
    ) or (
      select count(*) > 0 from project_invites where project_id = p.id and user_id = nullif(current_setting('session.user_id', TRUE), '')::integer and make_admin = true
    ) or session_is_superuser()
  $$;

grant execute on function projects_session_has_privileged_access to anon;
