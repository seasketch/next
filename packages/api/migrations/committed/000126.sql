--! Previous: sha1:d5a4138e3c52f55fe630cc1654cada5a9c2ec71b
--! Hash: sha1:d7709171c921e6f70fd0c49a8b4c632e6cc82032

-- Enter migration here
CREATE OR REPLACE FUNCTION public.surveys_submitted_response_count(survey public.surveys) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select count(*)::int from survey_responses where survey_id = survey.id and is_draft = false and is_practice = false and archived = false;
$$;
