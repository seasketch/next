--! Previous: sha1:cbbe291a2dc7d68035539e5fa16222d35be9f565
--! Hash: sha1:58ba09c231e65d526bb38e3ce455074102297ccc

-- Enter migration here
drop function if exists clear_form_element_style;
create or replace function clear_form_element_style(form_element_id int)
  returns form_elements
  language sql
  as $$
    update form_elements set background_image = null, background_color = null, background_image_placement = 'TOP', background_palette = null, secondary_color = null, text_variant = 'DYNAMIC', unsplash_author_url = null, unsplash_author_name = null, background_width = null, background_height = null where form_elements.id = form_element_id returning *;
  $$;

grant execute on function clear_form_element_style to seasketch_user;
