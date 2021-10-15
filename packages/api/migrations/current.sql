-- Enter migration here
alter table form_elements add column if not exists background_color text;
comment on column form_elements.background_color is '
Optional background color to transition the form to when this element is displayed.
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
create type form_element_background_edge_type as enum ('BLUR', 'CRISP');
alter table form_elements add column if not exists background_edge_type form_element_background_edge_type not null default 'BLUR'; 
comment on column form_elements.background_image_placement is '
Whether the blur the image -> background transition. Only for desktop.
';

alter table form_elements add column if not exists background_palette text[];

grant update(background_color, background_image, background_image_placement, background_palette, text_variant, background_edge_type) on table form_elements to seasketch_user;