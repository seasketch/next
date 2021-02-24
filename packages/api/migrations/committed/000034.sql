--! Previous: sha1:af0cd62839087a2cb536b0fc4968d9d87760dd2e
--! Hash: sha1:be3455e2b857910557d0a119d6f9caf88f646838

-- Enter migration here
drop function if exists update_basemap_layer_radio_group_label;
grant execute on function data_hosting_quota_left to anon;

create or replace function data_hosting_quota_left(pid int)
  returns int
  language plpgsql
  security definer
  stable
  as $$
    declare
      sum_bytes bigint;
      quota int;
    begin
      select coalesce(sum(byte_length), 0) into sum_bytes from data_sources where project_id = pid;
      return 524288000 - sum_bytes;
    end;
  $$;

comment on function data_hosting_quota_left is '@omit';

grant execute on function data_hosting_quota_left to anon;

drop policy if exists data_sources_insert on data_sources;
create policy data_sources_insert on data_sources for insert with check (
  session_is_admin(project_id) and data_hosting_quota_left(project_id) > 0
);
