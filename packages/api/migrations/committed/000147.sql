--! Previous: sha1:876f1112f11d2825911ac6e0af74eca65824315b
--! Hash: sha1:3c730ee942c1f5f8187c03e6819c50c3234ce32d

-- Enter migration here
-- This migration adds back support for current_project* functions so that
-- the new offline branch can run side-by-side with master using a staging
-- deployment.
-- While this is going into the migration system, it's important that the
-- current database can be "hotpatched" by copy-pasting the entire migration.
-- Later, when the offline branch is deployed, this migration will be run
-- again so it must be idempotent.

DROP FUNCTION IF EXISTS current_project;
CREATE FUNCTION public.current_project() RETURNS public.projects
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    *
  FROM
    projects
  WHERE
    id = nullif (current_setting('session.project_id', TRUE), '')::integer
$$;

comment on function current_project is '@deprecated Use projectBySlug() instead';
grant execute on function current_project to anon;

drop function if exists current_project_public_details;
drop function if exists project_public_details(text);
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

create or replace function current_project_public_details()
  returns public_project_details
  stable
  security definer
  language sql
  as $$
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
    id = nullif (current_setting('session.project_id', TRUE), '')::integer
$$;

comment on function current_project_public_details is '@deprecated Use projectPublicDetails(slug) instead';
grant execute on function current_project_public_details to anon;

drop function if exists current_project_access_status;
CREATE FUNCTION public.current_project_access_status() RETURNS public.project_access_status
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      access_control_setting project_access_control_setting;
      approved_request boolean;
      uid int;
      admin_bit boolean;
      pid int;
      email_verified boolean;
    begin
      select nullif (current_setting('session.project_id', TRUE), '')::integer into pid;
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

comment on function current_project_access_status is '@deprecated Use project_access_status(slug) instead';
grant execute on function current_project_access_status to anon;

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
