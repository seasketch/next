--! Previous: sha1:02e45756b70820a4a7dbf64d7732f24c952bfcd9
--! Hash: sha1:b53d0ae122b7ae1c5a9ac6395ebd460bdf6beef3

-- Enter migration here
alter table projects add column if not exists hide_forums boolean not null default false;
alter table projects add column if not exists hide_sketches boolean not null default false;

grant update(hide_forums, hide_sketches) on projects to seasketch_user;
