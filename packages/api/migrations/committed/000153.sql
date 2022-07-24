--! Previous: sha1:f0f437106aed3f160ba6a9dbb8ddcefbdbdb0e7f
--! Hash: sha1:61e5b9e753983b6b2acff217ce688bf2e9f244c2

-- Enter migration here
alter table survey_responses drop constraint if exists survey_responses_offline_id_key;
DROP function if exists create_survey_response;
CREATE OR REPLACE FUNCTION public.create_survey_response("surveyId" integer, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean, practice boolean, offline_id uuid) RETURNS public.survey_responses
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
        insert into survey_responses (survey_id, data, user_id, is_draft, is_facilitated, bypassed_duplicate_submission_control, is_practice, offline_id) values ("surveyId", response_data, nullif(current_setting('session.user_id', TRUE), '')::int, draft, facilitated, bypassed_submission_control, practice, offline_id) returning * into response;
        return response;
      else
        raise exception 'Access denied to % survey. is_disabled = %', access_type, is_disabled;
      end if;
    end;
  $$;

grant execute on function create_survey_response to anon;
