--! Previous: sha1:95c2f7d43e8f21b110a08cb0f8ac19d007db64b5
--! Hash: sha1:0afdb308b1bc24473af5ff8187311e5668e18abe

-- Enter migration here
alter table data_sources_buckets add column if not exists offline boolean not null default false;
comment on column data_sources_buckets.offline is 'Indicates the DataHostingStack for this region has been deleted';
