--! Previous: sha1:6d911bef85f0be73bbab249dcc473bd828e259a9
--! Hash: sha1:4e8180ffb27c3cc0eaa2b1087c0db65e29ccdaa1

-- Enter migration here
-- Registered users invited to a survey, or unregistered users with an invite token, should have access to:
--   * The parent project
--   * The survey
--   * The form related to the survey
--   * Form fields related to that form
--   * field rules related to the form
--   * any sketch classes related to the form
--   * any protected layers related to the form

CREATE OR REPLACE FUNCTION public.session_has_project_access(pid integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    -- Here we give access if the project is public, if the session is an admin,
    -- or if the session belongs to an approved participant
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
    session_is_approved_participant(pid) or  
    -- session has a survey invite token with matching projectId
    exists(
      select
        1
      from
        survey_invites
      inner join
        surveys
      on
        surveys.id = survey_invites.survey_id
      where
        surveys.project_id = pid and 
        (
          survey_invites.user_id = nullif(current_setting('session.user_id', TRUE), '')::int or
          (
            survey_invites.email = nullif(current_setting('session.canonical_email', TRUE), '') and
            current_setting('session.email_verified', true) = 'true'
          ) or
          survey_invites.email = nullif(current_setting('session.survey_invite_email', TRUE), '')
        )            
    )
  $$;

create or replace function session_has_survey_invite(survey_id int)
  returns boolean
  security definer
  language sql
  as $$
    select exists (
      select
        1
      from
        survey_invites
      where
        survey_invites.survey_id = survey_id and (
          survey_invites.user_id = nullif(current_setting('session.user_id', TRUE), '')::int or
          (
            survey_invites.email = nullif(current_setting('session.canonical_email', TRUE), '') and
            current_setting('session.email_verified', true) = 'true'
          ) or
          survey_invites.email = nullif(current_setting('session.survey_invite_email', TRUE), '')
        )
    )
  $$;

grant execute on function session_has_survey_invite to anon;
comment on function session_has_survey_invite is '@omit';

drop policy if exists surveys_select on surveys;
CREATE POLICY surveys_select ON public.surveys FOR SELECT TO anon USING (
  public.session_is_admin(project_id) OR 
  session_has_survey_invite(id) OR
  (
    public.session_has_project_access(project_id) AND 
    is_disabled = false AND (
      access_type = 'PUBLIC'::public.survey_access_type OR 
      public.session_in_group(
        public.survey_group_ids(id)
      )
    )
  )
);

CREATE or replace FUNCTION public.session_can_access_form(fid integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select session_is_admin((select project_id_for_form_id(fid))) or 
    session_has_survey_invite((select survey_id from forms where id = fid)) or
    (
      session_has_project_access((select project_id_for_form_id(fid))) and (
        session_on_acl((
          select 
            id 
          from 
            access_control_lists 
          where 
            access_control_lists.sketch_class_id = sketch_class_id
        )) or (
          exists(
            select
              id
            from
              surveys
            where
              id = (select survey_id from forms where forms.id = fid) and
              (
                is_disabled = false and (
                  access_type = 'PUBLIC' or session_in_group(survey_group_ids(surveys.id))
                )
              )
          )
        )
      )
    )
  $$;


create or replace function after_response_submission()
  returns trigger
  security definer
  language plpgsql
  volatile
  as $$
    begin
      update
        survey_invites
      set 
        was_used = true
      where
        survey_invites.survey_id = NEW.survey_id and (
          survey_invites.user_id = nullif(current_setting('session.user_id', TRUE), '')::int or
          survey_invites.email = nullif(current_setting('session.canonical_email', TRUE), '') or
          survey_invites.email = nullif(current_setting('session.survey_invite_email', TRUE), '')
        );
      return NEW;
    end;
  $$;

drop trigger if exists after_response_submission on survey_responses;
create trigger after_response_submission
  after insert or update
  on survey_responses
  for each row
  execute procedure after_response_submission();
