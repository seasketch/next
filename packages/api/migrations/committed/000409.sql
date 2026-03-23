--! Previous: sha1:dc9cf8823cf60ccf033f246448267dadad86d479
--! Hash: sha1:9103cd417669d4a9ec01575ac8a1be6a0dffb78b

-- Enter migration here
alter table surveys drop column if exists limit_response_access_to_listed_users;
alter table surveys add column if not exists limit_response_access_to_listed_users text[] not null default '{}'::text[];

grant select(limit_response_access_to_listed_users) on surveys to anon;
