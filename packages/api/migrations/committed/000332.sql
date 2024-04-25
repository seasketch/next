--! Previous: sha1:28c45bbfc20775c66b3bebee36be1798e9af2f66
--! Hash: sha1:5ee4e72d4f7f8783cfe5a111000c54384d242908

-- Enter migration here
create or replace function data_sources_hosting_quota_used(source data_sources)
  returns bigint
  language sql
  security definer
  stable
  as $$
    select coalesce(sum(size), 0) from data_upload_outputs where data_source_id = source.id;
  $$;

grant execute on function data_sources_hosting_quota_used to seasketch_user;

drop function if exists data_sources_outputs(data_sources);
create or replace function data_sources_outputs(source data_sources)
  returns setof data_upload_outputs
  language sql
  security definer
  stable
  as $$
    select * from data_upload_outputs where data_source_id = source.id;
  $$;

grant execute on function data_sources_outputs to seasketch_user;

comment on function data_sources_outputs is '@simpleCollections only';
