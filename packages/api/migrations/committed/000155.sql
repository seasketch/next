--! Previous: sha1:ab573def4bf856394ae7ea64b9cab0f5cfd677a0
--! Hash: sha1:34f206389b49ffc20b8d609c0e55828b26970b86

-- Enter migration here
alter table basemaps drop column if exists is_offline_enabled;
