--! Previous: sha1:e81a08d217fbe8c6d40094ae3c537b4c17e363ae
--! Hash: sha1:215e5f0ee69562bdda9fdaae4f45680fa019f83b

-- Enter migration here
alter table data_sources_buckets add column if not exists bucket text;
grant select (bucket) on data_sources_buckets to seasketch_user;
