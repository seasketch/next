--! Previous: sha1:379a46ca6f4c70925dc45522d4217dd50798f095
--! Hash: sha1:2e003b78168d3a477834f8d938fbe4061d55e18d
--! Message: Stop survey invites from granting project access

-- A survey invite applies to one survey. It is not permission to open the project.
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
        access_control = 'public'
    ) or
    session_is_admin(pid) or
    session_is_approved_participant(pid)
  $$;

comment on function public.session_has_project_access(pid integer) is '@omit';

-- The mutation is unused. Keep the function for database-owner callers, and
-- hide it from PostGraphile and from seasketch_user.
revoke all on function public.create_survey_invites(
  integer,
  boolean,
  boolean,
  text[],
  public.survey_invite_options[]
) from seasketch_user;

comment on function public.create_survey_invites(
  integer,
  boolean,
  boolean,
  text[],
  public.survey_invite_options[]
) is '@omit';
