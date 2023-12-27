--! Previous: sha1:b53d0ae122b7ae1c5a9ac6395ebd460bdf6beef3
--! Hash: sha1:ce627d322f59b0d212d699b84f86719b0a480cc8

-- Enter migration here
alter table projects add column if not exists hide_overlays boolean not null default false;

grant update (hide_overlays) on projects to seasketch_user;
