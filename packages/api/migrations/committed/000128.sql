--! Previous: sha1:f688f20bc01331d0a426b1b4fc2ccad367b9b114
--! Hash: sha1:8e2e11157dccb12056c70b51bd23bf5ab2228487

-- Enter migration here
alter table form_element_types add column if not exists allow_admin_updates boolean not null default true;
update form_element_types set allow_admin_updates = false where component_name = 'Consent';

drop function if exists modify_survey_answers;
create or replace function modify_survey_answers(response_ids int[], form_element_id int, answer jsonb)
  returns setof survey_responses
  language sql
  as $$
    with t as (
      -- Any generic query which returns rowid and corresponding calculated values
      select 
        form_elements.id as id,
        form_element_types.allow_admin_updates and form_element_types.is_input as allow_updates
      from form_elements
      inner join
        form_element_types
      on
        form_element_types.component_name = form_elements.type_id
      where
        form_elements.id = form_element_id
    )
    update 
      survey_responses 
    set data = jsonb_set(data, ARRAY[form_element_id::text], answer, true)
    from t
    where survey_responses.id = any(response_ids) and 
    t.allow_updates = true
    returning survey_responses.*;
  $$;

grant execute on function modify_survey_answers to seasketch_user;
