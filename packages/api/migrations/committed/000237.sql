--! Previous: sha1:0d0e27944fcdceb0b43705ab232737cd2ad27f2f
--! Hash: sha1:cb3a2860791adbd0ae51a846baeeeeb97be569c5

-- Enter migration here
alter table projects add column if not exists translated_props jsonb not null default '{}'::jsonb;
grant select(translated_props) on projects to anon;
alter table table_of_contents_items add column if not exists translated_props jsonb not null default '{}'::jsonb;
grant select(translated_props) on table_of_contents_items to anon;
