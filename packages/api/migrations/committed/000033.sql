--! Previous: sha1:c32d48dc0cd43a5e6468f44bceb09789bcd48d34
--! Hash: sha1:af0cd62839087a2cb536b0fc4968d9d87760dd2e

-- Enter migration here
alter table optional_basemap_layers add column if not exists options jsonb;
alter table optional_basemap_layers drop column if exists group_label;
drop TRIGGER if exists check_optional_basemap_layers on optional_basemap_layers;
