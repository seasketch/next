-- Enter migration here
alter table form_elements add column if not exists background_color text;
comment on column form_elements.background_color is '
Optional background color to transition the form to when this element is displayed.
';

alter table form_elements add column if not exists secondary_color text;
comment on column form_elements.secondary_color is '
Color used to style navigation controls
';

alter table form_elements drop column text_variant;
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

