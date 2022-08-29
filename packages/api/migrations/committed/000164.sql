--! Previous: sha1:8f68a24c5c6c562a5ae02282ca2808b059930ac1
--! Hash: sha1:7411aefca6fc936722b5ce2ac10f08389f80e9ed

-- Enter migration here
alter table project_participants add column if not exists approved_by int references users(id) on delete cascade;
alter table project_participants add column if not exists denied_by int references users(id) on delete cascade;
alter table project_participants add column if not exists approved_or_denied_on timestamp with time zone;


CREATE OR REPLACE FUNCTION projects_access_requests(p projects, order_by participant_sort_by DEFAULT 'NAME'::participant_sort_by, direction public.sort_by_direction DEFAULT 'ASC'::public.sort_by_direction) RETURNS SETOF users
    LANGUAGE sql STABLE
    AS $$
  SELECT
    users.*
  FROM
    users
    INNER JOIN project_participants ON (project_participants.user_id = users.id)
    INNER JOIN user_profiles ON (user_profiles.user_id = users.id)
  WHERE
    session_is_admin(p.id) and
    project_participants.project_id = p.id and
    (project_participants.share_profile = true and project_participants.approved = false and p.access_control != 'public'::project_access_control_setting)
  ORDER BY
    CASE WHEN direction = 'ASC' THEN
      CASE order_by
      WHEN 'NAME' THEN
        user_profiles.fullname
      WHEN 'EMAIL' THEN
        user_profiles.email
      END
    END ASC,
    CASE WHEN direction = 'DESC' THEN
      CASE order_by
      WHEN 'NAME' THEN
        user_profiles.fullname
      WHEN 'EMAIL' THEN
        user_profiles.email
      END
    END DESC
$$;

grant execute on function projects_access_requests to seasketch_user;

create or replace function users_needs_access_request_approval(u users, slug text)
  returns boolean
  language sql
  stable
  as $$
    select exists (select 1 from project_participants where project_participants.user_id = u.id and project_participants.approved = false and project_participants.project_id = (select id from projects where projects.slug = users_needs_access_request_approval.slug and projects.access_control != 'public'))
  $$;

grant execute on function users_needs_access_request_approval to seasketch_user;

create or replace function users_access_request_denied(u users, slug text)
  returns boolean
  language sql
  stable
  as $$
    select exists (
      select 
        1 
      from 
        project_participants 
      where 
        project_participants.user_id = u.id and 
        project_participants.approved = false and 
        project_participants.denied_by is not null and
        project_participants.project_id = (
          select id from projects where projects.slug = users_access_request_denied.slug and projects.access_control != 'public'
        )
      )
  $$;

grant execute on function users_access_request_denied to seasketch_user;

drop function if exists approve_participant;
CREATE OR REPLACE FUNCTION public.approve_participant("projectId" integer, "userId" integer) RETURNS users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      user users;
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        update project_participants set approved = true, denied_by = null, approved_by = nullif(current_setting('session.user_id', TRUE), '')::integer, approved_or_denied_on = now() where user_id = "userId" and project_id = "projectId";
        select * into user from users where users.id = "userId";
        return user;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;

grant execute on function approve_participant to seasketch_user;

drop function if exists deny_participant;
CREATE OR REPLACE FUNCTION public.deny_participant("projectId" integer, "userId" integer) RETURNS users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      user users;
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        update project_participants set approved = false, approved_by = null, denied_by = nullif(current_setting('session.user_id', TRUE), '')::integer, approved_or_denied_on = now() where user_id = "userId" and project_id = "projectId";
        select * into user from users where users.id = "userId";
        return user;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;

grant execute on function deny_participant to seasketch_user;

create or replace function users_approved_by(u users, project_id int)
  returns users
  language sql
  stable
  security DEFINER
  as $$
    select 
      * 
    from 
      users 
    where 
      session_is_admin(project_id) and 
      id = (
        select 
          approved_by 
        from 
          project_participants 
        where 
          project_participants.project_id = users_approved_by.project_id and
          project_participants.user_id = u.id
      )
  $$;

grant execute on function users_approved_by to seasketch_user;

create or replace function users_denied_by(u users, project_id int)
  returns users
  stable
  language sql
  security DEFINER
  as $$
    select * from users where session_is_admin(project_id) and id = (select denied_by from project_participants where project_participants.project_id = users_denied_by.project_id and project_participants.user_id = u.id)
  $$;

grant execute on function users_denied_by to seasketch_user;

create or replace function users_approved_or_denied_on(u users, project_id int)
  returns timestamp
  stable
  language sql
  security DEFINER
  as $$
    select approved_or_denied_on from project_participants where user_id = u.id and project_participants.project_id = users_approved_or_denied_on.project_id and session_is_admin(users_approved_or_denied_on.project_id);
  $$;

grant execute on function users_approved_or_denied_on to seasketch_user;
