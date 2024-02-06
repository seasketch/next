--! Previous: sha1:4ea50e168e109391cda07cad450af30d78a2d338
--! Hash: sha1:2c3687f0ef3ad551ea52c7259f1e8ed52677b2d1

-- Enter migration here
alter table projects alter column enable_download_by_default set default false;
