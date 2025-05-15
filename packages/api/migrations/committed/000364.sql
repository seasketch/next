--! Previous: sha1:88e645ad059927d638ed93854d2602f01d98f948
--! Hash: sha1:91c219d767330553e05f9ab60c993432116155f2

-- Enter migration here
alter table projects add column if not exists show_scalebar_by_default boolean default false;
alter table projects add column if not exists show_legend_by_default boolean default false;

grant update(show_scalebar_by_default, show_legend_by_default) on projects to seasketch_user;
