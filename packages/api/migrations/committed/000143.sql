--! Previous: sha1:1475549a55a63ae1deb8bb156af0cd206c2a3038
--! Hash: sha1:1fab50febc4ee630896f37c4be785e21240e2753

-- Enter migration here
CREATE OR REPLACE FUNCTION public.project_access_status(pid int) RETURNS public.project_access_status
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      access_control_setting project_access_control_setting;
      approved_request boolean;
      uid int;
      admin_bit boolean;
      email_verified boolean;
    begin
      select nullif (current_setting('session.user_id', TRUE), '')::integer into 
      uid;
      select is_admin(pid, uid) into admin_bit;
      if current_setting('session.email_verified', TRUE) = 'true' then
        email_verified = true;
      else
        email_verified = false;
      end if;
      SELECT
        access_control
      into
        access_control_setting
      FROM
        projects
      WHERE
        id = pid;
      if access_control_setting is null then
        return 'PROJECT_DOES_NOT_EXIST'::project_access_status;
      end if;
      if session_has_project_access(pid) then
        return 'GRANTED'::project_access_status;
      end if;
      if uid is null then
        return 'DENIED_ANON'::project_access_status;
      end if;
      if access_control_setting = 'admins_only'::project_access_control_setting then
        if admin_bit and email_verified = false then
          return 'DENIED_EMAIL_NOT_VERIFIED'::project_access_status;
        else
          return 'DENIED_ADMINS_ONLY'::project_access_status;
        end if;
      end if;
      -- access control setting must be invite_only
      select 
        approved into approved_request 
      from 
        project_participants 
      where 
        user_id = uid and project_id = pid;
      if approved_request is null then
        return 'DENIED_NOT_REQUESTED'::project_access_status;
      elsif approved_request is false then
        return 'DENIED_NOT_APPROVED'::project_access_status;
      elsif email_verified is false then
        return 'DENIED_EMAIL_NOT_VERIFIED'::project_access_status;
      end if;
      raise exception 'Unknown reason for denying project access. userid = %, project_id = %', uid, pid;
    end;
$$;

grant execute on function project_access_status to anon;

drop function if exists current_project_public_details;
drop function if exists current_project_access_status;
drop function if exists project_public_details;
drop type if exists public_project_details;

CREATE TYPE public.public_project_details AS (
	id integer,
	name text,
	slug text,
	logo_url text,
	access_control public.project_access_control_setting,
	support_email text,
  access_status project_access_status
);



CREATE OR REPLACE FUNCTION public.project_public_details(slug text) RETURNS public.public_project_details
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    id,
    name,
    slug,
    logo_url,
    access_control,
    support_email,
    project_access_status(id) as access_status
  FROM
    projects
  WHERE
    projects.slug = "slug"
$$;


grant execute on function project_public_details to anon;
