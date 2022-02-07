--! Previous: sha1:a7315ab09beb38fb0a88fe73f3f45e49b08158b3
--! Hash: sha1:8ae8392f358eaf4b8614cfa9de065c3ab4b772ae

-- Enter migration here
CREATE or replace FUNCTION public.users_is_admin(u public.users) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      "isAdmin" boolean;
    begin
      select coalesce(is_admin, session_is_superuser(), false) into "isAdmin" from project_participants where user_id = u.id and project_id = current_setting('session.project_id', true)::int and session_is_admin(current_setting('session.project_id', true)::int);
      return coalesce("isAdmin", false);
    end;
  $$;
