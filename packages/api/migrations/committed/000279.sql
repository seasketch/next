--! Previous: sha1:c03348f526a26b2f96d8c2a454f6a03514cfd57d
--! Hash: sha1:6e14c22c9b93c63557203d4e25e5627d0ccf58f6

-- Enter migration here
CREATE OR REPLACE FUNCTION public.create_survey_response_v2("surveyId" integer, response_data json, facilitated boolean, draft boolean, bypassed_submission_control boolean, practice boolean, offline_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      access_type survey_access_type;
      is_disabled boolean;
      pid int;
      response survey_responses;
      response_id int;
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
        insert into survey_responses (survey_id, data, user_id, is_draft, is_facilitated, bypassed_duplicate_submission_control, is_practice, offline_id) values ("surveyId", response_data, nullif(current_setting('session.user_id', TRUE), '')::int, draft, facilitated, bypassed_submission_control, practice, offline_id) returning id into response_id;
        return response_id as id;
      else
        raise exception 'Access denied to % survey. is_disabled = %', access_type, is_disabled;
      end if;
    end;
  $$;

grant execute on function public.create_survey_response_v2 to anon;
