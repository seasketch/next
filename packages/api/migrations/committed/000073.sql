--! Previous: sha1:1d54640835d8e602bbcb1cfacd38672adc258cc9
--! Hash: sha1:62b5e2158ca83a406b93f328d06dcf35e938cdb4

-- Enter migration here
DROP POLICY IF EXISTS survey_responses_insert ON public.survey_responses;
revoke insert on survey_responses from anon;
revoke insert on survey_responses from seasketch_user;
-- grant insert on survey_responses to anon;
-- CREATE POLICY survey_responses_insert ON public.survey_responses FOR INSERT WITH CHECK (
--   public.it_me(user_id) or 
--   (
--     user_id is null and 
--     (select access_type from surveys where surveys.id = survey_id) = 'PUBLIC'::survey_access_type and
--     (select is_disabled from surveys where surveys.id = survey_id) = false
--   )
-- );
alter table survey_responses add column if not exists is_facilitated boolean not null default false;


drop function if exists session_member_of_group;
create or replace function session_member_of_group(groups int[])
  returns boolean
  language SQL
  stable
  security definer
  as $$
    select (select count(group_id) from project_group_members where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer and group_id = any(groups)) > 0;
$$;

drop function if exists create_survey_response;

create or replace function create_survey_response("surveyId" int, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean)
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
        insert into survey_responses (survey_id, data, user_id, is_draft, is_facilitated, bypassed_duplicate_submission_control) values ("surveyId", response_data, nullif(current_setting('session.user_id', TRUE), '')::int, draft, facilitated, bypassed_submission_control) returning * into response;
        return response;
      else
        raise exception 'Access denied to % survey. is_disabled = %', access_type, is_disabled;
      end if;
    end;
  $$;

grant EXECUTE on function create_survey_response to anon;

comment on column survey_responses.user_id is 'User account that submitted the survey. Note that if isFacilitated is set, the account may not be who is represented by the response content.';
comment on column survey_responses.is_facilitated is 'If true, a logged-in user entered information on behalf of another person, so userId is not as relevant.';
