--! Previous: sha1:6d0e0ecb4eb8cbce2e864dce288208def90f03d1
--! Hash: sha1:e3f0e93b74596af2758d245047060587ded98a81

-- Enter migration here
create or replace function update_data_hosting_quota(project_id int, quota bigint) 
  returns projects
  language sql
  security definer
  as $$
    update projects
    set data_hosting_quota = quota
    where id = project_id
    returning *;
  $$;

grant execute on function update_data_hosting_quota(int, bigint) to seasketch_superuser;
