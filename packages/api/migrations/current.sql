-- Enter migration here
alter table basemaps add column if not exists description text;