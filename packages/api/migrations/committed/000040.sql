--! Previous: sha1:6b54d95115feb3c205213e126c8257e52aade17a
--! Hash: sha1:95c2f7d43e8f21b110a08cb0f8ac19d007db64b5

-- Enter migration here
create or replace function get_default_data_sources_bucket() returns text
  language plpgsql stable security definer
  as $$
  declare
    bucket_id text;
  begin
    select url into bucket_id from data_sources_buckets where region = 'us-west-2';
    if bucket_id is null then
      select url into bucket_id from data_sources_buckets limit 1;
    end if;
    return bucket_id;
  end
$$;

grant execute on function get_default_data_sources_bucket to anon;

ALTER TABLE projects ALTER COLUMN data_sources_bucket_id SET DEFAULT get_default_data_sources_bucket();
