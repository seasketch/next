--! Previous: sha1:f17ec0db8d5bc41a0fc992b76ba47035cc52bd68
--! Hash: sha1:1ab744b3e85c1c397fe569304b0a306c1996dbdf

-- Enter migration here
create or replace function surveys_is_spatial(s surveys)
  returns boolean
  stable
  language sql
  as $$
    select count(id) > 0 from form_elements inner join form_element_types on form_element_types.component_name = form_elements.type_id where form_id = (select id from forms where survey_id = s.id) and form_element_types.is_spatial = true
  $$;

grant execute on function surveys_is_spatial to anon;
