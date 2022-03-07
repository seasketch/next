--! Previous: sha1:441ee74670b2388abbec276082cb1ad5ad2e14c6
--! Hash: sha1:48f5cb7684cbb38134c9524928aa3ff4c3860f67

-- Enter migration here
create or replace function copy_appearance(form_element_id int, copy_from_id int)
  returns form_elements
  language plpgsql
  security definer
  as $$
    declare
      return_value form_elements;
    begin
      if true or session_is_admin((project_id_for_form_id((select form_id from form_elements where id = form_element_id)))) then
        update 
          form_elements dst
        set background_image = f.background_image,
        background_color = f.background_color,
        secondary_color = f.secondary_color,
        background_palette = f.background_palette,
        unsplash_author_name = f.unsplash_author_name,
        unsplash_author_url = f.unsplash_author_url,
        background_height = f.background_height,
        background_width = f.background_width,
        layout = f.layout,
        text_variant = f.text_variant
        from
          form_elements f
        where
          f.id = copy_from_id and
          dst.id = form_element_id
        returning
          *
        into return_value;
        
        return return_value;      
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function copy_appearance to seasketch_user;

comment on function copy_appearance is 'Copies appearance settings like layout and background_image from one form element to another. Useful when initializing custom appearance on an element from the defaults set by a previous question.';

comment on column form_element_types.is_spatial is 'Indicates if the element type is a spatial data input. Components that implement these types are expected to render their own map (in contrast with elements that simply have their layout set to MAP_SIDEBAR_RIGHT|LEFT, which expect the SurveyApp component to render a map for them.';
