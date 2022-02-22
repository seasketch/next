--! Previous: sha1:604ca18758df0eaec25644225959b9a4dd85d8bf
--! Hash: sha1:d5a4138e3c52f55fe630cc1654cada5a9c2ec71b

-- Enter migration here
create or replace function make_responses_practice(ids int[])
  returns survey_responses
  language sql
  as $$
    update survey_responses set is_practice = true where id = any(ids) returning survey_responses.*;
$$;

grant execute on function make_responses_practice to seasketch_user;

alter table survey_responses add column if not exists archived boolean not null default false;

create or replace function archive_responses(ids int[])
  returns survey_responses
  language sql
  as $$
    update survey_responses set archived = true where id = any(ids) returning survey_responses.*;
$$;

grant execute on function archive_responses to seasketch_user;

CREATE OR REPLACE FUNCTION public.surveys_practice_response_count(survey public.surveys) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select count(*)::int from survey_responses where survey_id = survey.id and is_draft = false and is_practice = true and archived = false;
$$;

CREATE OR REPLACE FUNCTION public.surveys_archived_response_count(survey public.surveys) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select count(*)::int from survey_responses where survey_id = survey.id and is_draft = false and archived = true;
$$;

grant execute on function surveys_archived_response_count to seasketch_user;
