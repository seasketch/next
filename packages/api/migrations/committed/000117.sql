--! Previous: sha1:4024b34021a7a39cca8f7f442cd19d658892d90c
--! Hash: sha1:a7315ab09beb38fb0a88fe73f3f45e49b08158b3

-- Enter migration here
create or replace function form_elements_is_input(el form_elements)
  returns boolean
  stable
  language sql
  as $$
    select is_input from form_element_types where form_element_types.component_name = el.type_id;
  $$;

grant execute on function form_elements_is_input to anon;
