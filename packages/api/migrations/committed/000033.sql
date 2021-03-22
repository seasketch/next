--! Previous: sha1:6aa6643f8f7a20c9682fc30216e43c52480208cb
--! Hash: sha1:99ae529b7263600476f8b9882ca9514ecbf332d1

-- Enter migration here
alter table optional_basemap_layers add column if not exists options jsonb;
alter table optional_basemap_layers drop column if exists group_label;
drop TRIGGER if exists check_optional_basemap_layers on optional_basemap_layers;
