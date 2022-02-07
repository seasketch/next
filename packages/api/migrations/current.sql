-- Enter migration here
create or replace function survey_responses_account_email (r survey_responses)
  returns text
  stable
  language sql
  as $$
    select canonical_email from users where id = r.user_id; 
  $$;

grant execute on function survey_responses_account_email to seasketch_user;