--! Previous: sha1:8ae8392f358eaf4b8614cfa9de065c3ab4b772ae
--! Hash: sha1:bf1b9cdaa4bfa881aa29a19bc0c11b1de02a2f04

-- Enter migration here
create or replace function survey_responses_account_email (r survey_responses)
  returns text
  stable
  language sql
  as $$
    select canonical_email from users where id = r.user_id; 
  $$;

grant execute on function survey_responses_account_email to seasketch_user;
