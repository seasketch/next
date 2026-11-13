--! Previous: sha1:19e55b4f90681a07549d4eb0e1b693b786c966eb
--! Hash: sha1:986896581bd028cf7ac5a35ff3f9d67d388ed3a5
--! Message: hide deleted projects and limit admins-only access

-- Enter migration here

-- A deleted project is gone. An approved participant can enter an invite-only
-- project, and only an administrator can enter an admins-only project.
create or replace function public.session_has_project_access(pid integer) returns boolean
    language sql stable
    security definer
    parallel safe
    as $$
    select exists(
      select
        1
      from
        projects
      where
        projects.id = pid and
        projects.is_deleted = false and
        (
          projects.access_control = 'public'
          or session_is_admin(pid)
          or (
            projects.access_control = 'invite_only'
            and session_is_approved_participant(pid)
          )
        )
    )
  $$;

comment on function public.session_has_project_access(pid integer) is '@omit';

create or replace function public.project_access_status(pid integer) returns public.project_access_status
    language plpgsql stable
    security definer
    as $$
    declare
      access_control_setting project_access_control_setting;
      deleted boolean;
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
        access_control,
        is_deleted
      into
        access_control_setting,
        deleted
      FROM
        projects
      WHERE
        id = pid;
      if access_control_setting is null or deleted is true then
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
