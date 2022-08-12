--! Previous: sha1:7a2967d3f549802da6223e9be0d8878ed9f9f144
--! Hash: sha1:ea9607da5dc03734489ade69c1cc9b9dbe77e811

alter table offline_tile_settings
drop constraint offline_tile_settings_basemap_id_fkey,
add constraint offline_tile_settings_basemap_id_fkey FOREIGN KEY (basemap_id) REFERENCES basemaps(id) on delete cascade;
