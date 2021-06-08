--! Previous: sha1:32f255d8b7c2dd750009f0335e21d2808e226862
--! Hash: sha1:dfb905d236af17edca2ba09fe5cb5b85b0b1aaee

-- Enter migration here
alter table users add column if not exists canonical_email text;
comment on column users.canonical_email is '@omit';

CREATE OR REPLACE FUNCTION public.get_or_create_user_by_sub(_sub text, _email text, OUT user_id integer) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  WITH ins AS (
INSERT INTO users (sub, canonical_email)
      VALUES (_sub, _email)
    ON CONFLICT (sub)
      DO NOTHING
    RETURNING
      users.id)
    SELECT
      id
    FROM
      ins
    UNION ALL
    SELECT
      users.id
    FROM
      users
    WHERE
      sub = _sub
    LIMIT 1
$$;

COMMENT ON FUNCTION public.get_or_create_user_by_sub(_sub text, OUT user_id integer) IS '@omit
Incoming users from Auth0 need to be represented in our database. This function runs whenever a user with an unrecognized token calls the api.';

GRANT execute ON FUNCTION get_or_create_user_by_sub(_sub text, _email text, OUT user_id integer) TO anon;

create or replace function users_canonical_email(_user users)
  returns text
  language sql
  security DEFINER
  stable
  as $$
    select canonical_email from users where id in (select user_id from project_participants where project_participants.user_id = _user.id and session_is_admin(project_participants.project_id))
  $$;

grant execute on function users_canonical_email to seasketch_user;

comment on function users_canonical_email is '
Only visible to admins of projects a user has joined. Can be used for identification purposes since users will not gain any access control privileges until this email has been confirmed.
';
