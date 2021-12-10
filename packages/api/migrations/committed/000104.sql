--! Previous: sha1:f69ac42284fe2f65421128f7d4eb2ff2e0fb01ba
--! Hash: sha1:4c2a8f271a7c9dc5e4a0dee6d1cbfed1824aaa9e

-- Enter migration here
alter table basemaps add column if not exists is_disabled boolean not null default false;
comment on column basemaps.is_disabled is '
Used to indicate whether the basemap is included in the public basemap listing. Useful for hiding an option temporarily, or adding a basemap to the project which will only be used in surveys.
';
