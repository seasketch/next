--! Previous: sha1:caaedabf14d87a0132e268e731d74d789558a0c7
--! Hash: sha1:19e55b4f90681a07549d4eb0e1b693b786c966eb
--! Message: Remove group-based survey access

-- Survey access is no longer limited to invited groups. An enabled survey is
-- available to anyone who can open the project. Admins can still open a
-- disabled survey.

create or replace function public.session_can_access_form(fid integer) returns boolean
    language sql stable
    security definer
    as $$
    select session_is_admin((select project_id_for_form_id(fid))) or
    (
      session_has_project_access((select project_id_for_form_id(fid))) and (
        session_on_acl((
          select
            id
          from
            access_control_lists
          where
            access_control_lists.sketch_class_id is not null and
            access_control_lists.sketch_class_id = (select sketch_class_id from forms where id = fid)
        )) or (
          exists(
            select
              id
            from
              surveys
            where
              id = (select survey_id from forms where forms.id = fid) and
              is_disabled = false
          )
        )
      )
    )
  $$;

comment on function public.session_can_access_form(fid integer) is '@omit';

create or replace function public.create_survey_response("surveyId" integer, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean, practice boolean, offline_id uuid) returns public.survey_responses
    language plpgsql
    security definer
    as $$
    declare
      is_disabled boolean;
      pid int;
      response survey_responses;
    begin
      select
        surveys.project_id,
        surveys.is_disabled
      into
        pid,
        is_disabled
      from
        surveys
      where
        surveys.id = "surveyId";
      if session_is_admin(pid) or is_disabled = false then
        insert into survey_responses (survey_id, data, user_id, is_draft, is_facilitated, bypassed_duplicate_submission_control, is_practice, offline_id) values ("surveyId", response_data, nullif(current_setting('session.user_id', TRUE), '')::int, draft, facilitated, bypassed_submission_control, practice, offline_id) returning * into response;
        return response;
      else
        raise exception 'Access denied. is_disabled = %', is_disabled;
      end if;
    end;
  $$;

create or replace function public.create_survey_response_v2("surveyId" integer, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean, practice boolean, offline_id uuid) returns integer
    language plpgsql
    security definer
    as $$
    declare
      is_disabled boolean;
      pid int;
      response_id int;
    begin
      select
        surveys.project_id,
        surveys.is_disabled
      into
        pid,
        is_disabled
      from
        surveys
      where
        surveys.id = "surveyId";
      if session_is_admin(pid) or is_disabled = false then
        insert into survey_responses (survey_id, data, user_id, is_draft, is_facilitated, bypassed_duplicate_submission_control, is_practice, offline_id) values ("surveyId", response_data, nullif(current_setting('session.user_id', TRUE), '')::int, draft, facilitated, bypassed_submission_control, practice, offline_id) returning id into response_id;
        return response_id as id;
      else
        raise exception 'Access denied. is_disabled = %', is_disabled;
      end if;
    end;
  $$;

drop policy if exists surveys_select on public.surveys;
create policy surveys_select on public.surveys for select to anon
  using ((
    public.session_is_admin(project_id)
    or (
      public.session_has_project_access(project_id)
      and (is_disabled = false)
    )
  ));

drop function if exists public.before_survey_invited_groups_insert() cascade;
drop function if exists public.survey_group_ids(integer);
drop function if exists public.surveys_invited_groups(public.surveys);
drop function if exists public.update_survey_invited_groups(integer, integer[]);
drop table if exists public.survey_invited_groups;

alter table public.surveys drop column if exists access_type;
drop type if exists public.survey_access_type;

comment on column public.surveys.is_disabled is '
Disabled surveys will not be accessible to non-admins.
';

comment on column public.surveys.show_social_media_buttons is '
Show tools to respondents for sharing the survey on social media to encourage responses.
';
