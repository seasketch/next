--! Previous: sha1:1f054d2bf37800746a8156a63c5de0785980d4e0
--! Hash: sha1:441ee74670b2388abbec276082cb1ad5ad2e14c6

-- Enter migration here
drop function if exists modify_survey_answers;
create or replace function modify_survey_answers(response_ids int[], answers jsonb)
  returns setof survey_responses
  language sql
  as $$
    update 
      survey_responses 
    set data = data || answers - (
      select 
        array_agg(form_elements.id::text)
      from form_elements
      inner join
        form_element_types
      on
        form_element_types.component_name = form_elements.type_id
      where
        (
          form_element_types.allow_admin_updates = false or 
          form_element_types.is_input = false
        ) and
        form_elements.form_id = (
          select 
            id 
          from 
            forms 
          where 
            forms.survey_id = (
              select survey_id from survey_responses where survey_responses.id = any(response_ids) limit 1
            )
          limit 1
        )
    )
    where survey_responses.id = any(response_ids)
    returning survey_responses.*;
  $$;

grant execute on function modify_survey_answers to seasketch_user;
