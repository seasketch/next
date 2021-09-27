--! Previous: sha1:2c882b88dde489f22b70a77097a6ae4c7cd57836
--! Hash: sha1:1d54640835d8e602bbcb1cfacd38672adc258cc9

-- Enter migration here
drop function if exists forms_elements;
create or replace function forms_form_elements(f forms)
  returns setof form_elements
  stable
  language sql
  as $$
    select * from form_elements where form_elements.form_id = f.id order by position asc;
  $$;

grant execute on function forms_form_elements to anon;

comment on function forms_form_elements is '
@simpleCollections only
Lists FormElements in order for rendering
';
