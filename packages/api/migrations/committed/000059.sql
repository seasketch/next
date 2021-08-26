--! Previous: sha1:a085742433e5d26bb502ec591555fc44fe84b4b9
--! Hash: sha1:1898f28347ea9857039099dc7d87fdd6bca296d1

-- Enter migration here
alter table projects drop column if exists support_email;
alter table projects add column support_email text;

create or replace function first_admin_email(pid int)
  returns text
  language sql
  security definer
  as $$
    select canonical_email from users where id = ((select user_id from project_participants where project_id = pid and is_admin = true limit 1));
  $$;

update projects set support_email = first_admin_email(id);

drop function first_admin_email;

alter table projects alter column support_email set not null;

grant select (support_email) on table projects to anon;

drop function if exists current_project_public_details;
drop function if exists current_project_access_status;
drop type if exists public_project_details;

create type public_project_details as (id int, name text, slug text, logo_url text, access_control project_access_control_setting, support_email text);

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
    support_email
  FROM
    projects
  WHERE
    id = nullif (current_setting('session.project_id', TRUE), '')::integer
$$;

grant execute on function current_project_public_details to anon;

comment on function current_project_public_details is '
Executable by all users and used to display a "gate" should a user arrive directly on a project url without authorization.
';

drop type if exists project_access_status;
create type project_access_status as enum (
  'GRANTED',
  'DENIED_ANON',
  'DENIED_NOT_REQUESTED',
  'DENIED_NOT_APPROVED',
  'DENIED_ADMINS_ONLY',
  'DENIED_EMAIL_NOT_VERIFIED',
  'PROJECT_DOES_NOT_EXIST'
);

create or replace function current_project_access_status()
  returns project_access_status
  stable
  security definer
  language plpgsql
  as $$
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

grant execute on function current_project_access_status to anon;


comment on function current_project_access_status is '
Use to indicate to a user why they cannot access the given project, if denied.
';
