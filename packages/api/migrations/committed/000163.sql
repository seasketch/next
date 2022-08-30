--! Previous: sha1:daa9e94c64ecf1f0c84c53af6419a887a35538cb
--! Hash: sha1:8f68a24c5c6c562a5ae02282ca2808b059930ac1

-- Enter migration here
create or replace function project_invites_participation_status(invite project_invites)
  returns participation_status
  language sql
  security definer
  stable
  as $$
    select users_participation_status(users.*, invite.project_id) from users where users.id = invite.user_id and session_is_admin(invite.project_id);
  $$;

grant execute on function project_invites_participation_status to seasketch_user;
