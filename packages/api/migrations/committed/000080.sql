--! Previous: sha1:7094acbf0cc711a1ab65d4ae999764caa54d8ed4
--! Hash: sha1:cbbe291a2dc7d68035539e5fa16222d35be9f565

-- Enter migration here
alter table form_elements add column if not exists background_color text;
comment on column form_elements.background_color is '
Optional background color to transition the form to when this element is displayed.
';

alter table form_elements add column if not exists secondary_color text;
comment on column form_elements.secondary_color is '
Color used to style navigation controls
';

alter table form_elements drop column if exists text_variant;
drop type if exists form_element_text_variant;
create type form_element_text_variant as enum ('LIGHT', 'DARK', 'DYNAMIC');
alter table form_elements add column if not exists text_variant form_element_text_variant not null default 'DYNAMIC';
comment on column form_elements.text_variant is '
Indicates whether the form element should be displayed with dark or light text variants to match the background color. Admin interface should automatically set this value based on `background_color`, though admins may wish to manually override.
';

alter table form_elements add column if not exists background_image text;
comment on column form_elements.background_image is '
@omit create,update
Optional background image to display when this form_element appears.
';

alter table form_elements drop column if exists background_image_placement;
drop type if exists form_element_background_image_placement;
create type form_element_background_image_placement as enum ('LEFT', 'RIGHT', 'TOP', 'COVER');
alter table form_elements add column if not exists background_image_placement form_element_background_image_placement not null default 'TOP';
comment on column form_elements.background_image_placement is '
Layout of image in relation to form_element content.
';


alter table form_elements drop column if exists background_edge_type;
drop type if exists form_element_background_edge_type;


alter table form_elements add column if not exists background_palette text[];
alter table form_elements add column if not exists unsplash_author_name text;
alter table form_elements add column if not exists unsplash_author_url text;

comment on column form_elements.unsplash_author_name is '@omit create,update';
comment on column form_elements.unsplash_author_url is '@omit create,update';

alter table form_elements add column if not exists background_width int;
alter table form_elements add column if not exists background_height int;

grant update(background_color, background_image, background_image_placement, background_palette, text_variant, secondary_color, unsplash_author_name, unsplash_author_url, background_width, background_height) on table form_elements to seasketch_user;


create or replace function clear_form_element_style(id int)
  returns form_elements
  language sql
  as $$
    update form_elements set background_image = null, background_color = null, background_image_placement = 'TOP', background_palette = null, secondary_color = null, text_variant = 'DYNAMIC', unsplash_author_url = null, unsplash_author_name = null, background_width = null, background_height = null where form_elements.id = "id" returning *;
  $$;

grant execute on function clear_form_element_style to seasketch_user;

CREATE OR REPLACE FUNCTION public.initialize_survey_form_from_template(survey_id integer, template_id integer) RETURNS public.forms
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      form forms;
    begin
      if session_is_admin((select project_id from surveys where id = survey_id)) = false then
        raise exception 'Must be project admin';
      end if;
      insert into forms (survey_id) values (survey_id) returning * into form;
      insert into 
        form_elements (
          form_id, 
          body, 
          type_id, 
          is_required, 
          export_id, 
          position, 
          component_settings,
          background_color,   
          background_image,     
          background_palette,   
          secondary_color,      
          unsplash_author_name, 
          unsplash_author_url,  
          background_width,     
          background_height,    
          text_variant,
          background_image_placement
        )
      select 
        form.id, 
        body, 
        type_id, 
        is_required, 
        export_id, 
        position, 
        component_settings,
        background_color,     
        background_image,     
        background_palette,   
        secondary_color,      
        unsplash_author_name, 
        unsplash_author_url,  
        background_width,     
        background_height,    
        text_variant,
        background_image_placement
      from
        form_elements
      where
        form_elements.form_id = template_id
      order by position asc;
      
      return form;
    end
  $$;

create or replace function _create_survey(name text, project_id int, template_id int default null)
  returns surveys
  language plpgsql
  security definer
  as $$
    declare
      surveyid int;
      templateid int;
      survey surveys;
    begin
      if template_id is null then
        select id into templateid from forms where template_name = 'Basic Template';
        if templateid is null then
          raise exception 'Form template with name "Basic Template" has not been created! See https://github.com/seasketch/next/wiki/Bootstrapping-Survey-Templates';
        end if;
      else
        templateid = template_id;
      end if;
      if session_is_admin(project_id) then
        insert into surveys (name, project_id) values (name, project_id) returning id into surveyid;
        perform initialize_survey_form_from_template(surveyid, templateid);
        select * into survey from surveys where id = surveyid;
        return survey;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;
