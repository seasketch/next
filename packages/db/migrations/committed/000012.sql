--! Previous: sha1:3ff56f9cdc6c7bd3afafc300a9f953f5a14a5f42
--! Hash: sha1:d2f9c3b9a6a308384237f8bd2899fd19bfc6b4f6

-- Clean up some of the rls policies using helper functions
drop policy if exists select_project_participants on project_participants;

create policy select_project_participants on project_participants using (
  it_me(user_id) or
  session_is_admin(project_id)
);

create or replace function has_session()
  returns boolean
  security definer
  language sql
  stable
  as $$
    select nullif(current_setting('session.user_id', TRUE), '')::integer is not null
  $$;

grant execute on function has_session to anon;
comment on function has_session is '@omit';

create or replace function session_is_approved_participant(pid integer)
  returns boolean
  security definer
  language sql
  stable
  as $$
    select has_session() and EXISTS (
      SELECT 
        1
      FROM
        project_participants
      WHERE (
        it_me(project_participants.user_id) and
        project_participants.project_id = pid
      ) AND project_participants.approved = TRUE
    )
  $$;

grant execute on function session_is_approved_participant to anon;
comment on function session_is_approved_participant is '@omit';
grant execute on function session_is_admin to anon;

DROP POLICY IF EXISTS admin_update_projects on projects;
DROP POLICY IF EXISTS seasketch_user_select_projects ON projects;
DROP POLICY IF EXISTS superuser_projects_select ON projects;
drop policy if exists superuser_update_projects on projects;
DROP POLICY IF EXISTS anon_projects_select_listed ON projects;

drop policy if exists projects_select on projects;
create policy projects_select on projects for select to anon using (
  is_deleted = false
  and (
    is_listed = true or access_control = 'public' or (
      session_is_admin(id) or
      (access_control = 'invite_only' and session_is_approved_participant(id))
    )
  )
);

drop policy if exists projects_update on projects;
create policy projects_update on projects for update to seasketch_user using (
  session_is_admin(id)
) with check (
  session_is_admin(id)
);



drop policy if exists user_profile_read on user_profiles;
drop policy if exists select_user_profile on public.user_profiles;
drop policy if exists user_profile_update on user_profiles;

create policy select_user_profile on user_profiles for select to seasketch_user using (
  it_me(user_id)
  OR EXISTS (
    SELECT 
      1
    FROM
      project_participants
    WHERE
      project_participants.user_id = user_profiles.user_id AND
      project_participants.share_profile = true and
      session_is_admin(project_participants.project_id)
  )
);

create policy user_profile_update on user_profiles for update using (
  it_me(user_id)) with check (it_me(user_id));
