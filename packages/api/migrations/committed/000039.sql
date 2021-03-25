--! Previous: sha1:39a0df4cc1a269a8fd12ed391d71299d6369f626
--! Hash: sha1:6b54d95115feb3c205213e126c8257e52aade17a

-- Enter migration here
alter table data_sources_buckets rename bucket to url;
comment on column data_sources_buckets.url is 'Base url for this point-of-presence.';
