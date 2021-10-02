--! Previous: sha1:bbe7c9b64e6c88b4e2c8db633c4e07785ff3fada
--! Hash: sha1:7f5b241539c0a9fd52824ffce6def3d3fb3b021c

-- Enter migration here
alter table surveys add column if not exists show_progress bool not null default true;
