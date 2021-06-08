--! Previous: sha1:8c54281c4bb58ca5408b8da089e2581ffd116f0c
--! Hash: sha1:d1f1bd29b992e094909a401667873b256d41c1bb

-- Enter migration here
drop function if exists users_is_admin(public.users, text);
CREATE or replace FUNCTION public.users_is_admin(u public.users) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      "isAdmin" boolean;
    begin
      select coalesce(is_admin, false) into "isAdmin" from project_participants where user_id = u.id and project_id = current_setting('session.project_id', true)::int and session_is_admin(current_setting('session.project_id', true)::int);
      return coalesce("isAdmin", false);
    end;
  $$;

grant execute on function public.users_is_admin(public.users) to anon;

comment on function public.users_is_admin(public.users) is '
Indicates if user is admin on the current project, indicated by the `x-ss-slug` header.
';

drop function if exists users_banned_from_forums(public.users, int);
CREATE or replace FUNCTION public.users_banned_from_forums(u public.users) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      is_banned boolean;
    begin
      if session_is_admin(current_setting('session.project_id', true)::int) then
        select is_banned_from_forums into is_banned from project_participants where project_id = current_setting('session.project_id', true)::int and user_id = u.id;
        return is_banned;
      else
        raise exception 'Must be a project admin';
      end if;
    end;
  $$;


--
-- Name: FUNCTION users_banned_from_forums(u public.users, "projectId" integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.users_banned_from_forums(u public.users) IS 'Whether the user has been banned from the forums. Use `disableForumPosting()` and `enableForumPosting()` mutations to modify this state. Accessible only to admins.';

grant execute on function users_banned_from_forums to anon;


Drop function if exists public.users_groups(public.users, text);
CREATE OR REPLACE FUNCTION public.users_groups(u public.users) RETURNS SETOF public.project_groups
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      * 
    from 
      project_groups 
    where 
      project_id = (
        current_setting('session.project_id', true)::int
      ) and 
      session_is_admin(current_setting('session.project_id', true)::int) and
      id = any((
        select group_id from project_group_members where user_id = u.id
      ))
  $$;

grant execute on function users_groups to seasketch_user;

COMMENT ON FUNCTION public.users_groups(u public.users) IS '
@simpleCollections only
List of groups for the given project and user. Only available to project admins.
';
