--! Previous: sha1:58ba09c231e65d526bb38e3ce455074102297ccc
--! Hash: sha1:67e3630324492e7a6b391a7cdfb888814911a355

-- Enter migration here
alter table survey_responses add column if not exists is_practice boolean not null default false;

drop function if exists create_survey_response;

create or replace function create_survey_response("surveyId" int, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean, practice boolean)
  returns survey_responses
  language plpgsql
  security definer
  as $$
    declare
      access_type survey_access_type;
      is_disabled boolean;
      pid int;
      response survey_responses;
    begin
      select 
        surveys.project_id, 
        surveys.access_type, 
        surveys.is_disabled 
      into 
        pid, 
        access_type, 
        is_disabled 
      from 
        surveys 
      where 
        surveys.id = "surveyId";
      -- TODO: improve access control to consider group membership
      if session_is_admin(pid) or (is_disabled = false and (access_type = 'PUBLIC'::survey_access_type) or (access_type = 'INVITE_ONLY'::survey_access_type and session_member_of_group((select array_agg(group_id) from survey_invited_groups where survey_id = "surveyId")))) then
        insert into survey_responses (survey_id, data, user_id, is_draft, is_facilitated, bypassed_duplicate_submission_control, is_practice) values ("surveyId", response_data, nullif(current_setting('session.user_id', TRUE), '')::int, draft, facilitated, bypassed_submission_control, practice) returning * into response;
        return response;
      else
        raise exception 'Access denied to % survey. is_disabled = %', access_type, is_disabled;
      end if;
    end;
  $$;

grant EXECUTE on function create_survey_response to anon;

create or replace function surveys_submitted_response_count (survey surveys)
  returns int
  language sql
  stable
  as $$
    select count(*)::int from survey_responses where survey_id = survey.id and is_draft = false and is_practice = false;
$$;

create or replace function surveys_practice_response_count (survey surveys)
  returns int
  language sql
  stable
  as $$
    select count(*)::int from survey_responses where survey_id = survey.id and is_draft = false and is_practice = true;
$$;

grant execute on function surveys_practice_response_count to seasketch_user;
