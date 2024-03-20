--! Previous: sha1:fbec08c9b15710e1b43d0302f5a8e31bfa1034bc
--! Hash: sha1:e8c7237416717fb258be458aa353c2543f361341

-- Enter migration here
CREATE OR REPLACE FUNCTION public.projects_data_hosting_quota_used(p public.projects) RETURNS bigint
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    declare
      sum_bytes bigint;
      quota bigint;
    begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
    select 
      sum(size) 
    into 
      sum_bytes 
    from 
      data_upload_outputs
    where
      data_source_id = any (
        select id from data_sources where id = any (
          select data_source_id from data_layers where id = any (
            select data_layer_id from table_of_contents_items where project_id = p.id and data_layer_id is not null and is_draft = true
          )
        )
      );
    select projects_data_hosting_quota(p) into quota;
    if sum_bytes < quota then
      return sum_bytes;
    end if;
    if sum_bytes is null then
      return 0;
    end if;
    return quota;
    end;
  $$;

create or replace function public.projects_uploaded_draft_data_sources(p public.projects)
  returns setof data_sources
  language sql
  security definer
  stable as $$
  select * from data_sources where type = any ('{seasketch-mvt,seasketch-vector,seasketch-raster}') and id = any (
    select data_source_id from data_layers where id = any (
      select data_layer_id from table_of_contents_items where project_id = p.id and data_layer_id is not null and is_draft = true
    )
  );
$$;

grant execute on function projects_uploaded_draft_data_sources to seasketch_user;

comment on function projects_uploaded_draft_data_sources is '@simpleCollections only';

drop function if exists data_sources_quota_used;
drop type if exists quota_details;
create type quota_details as (
  bytes bigint,
  id int,
  type data_upload_output_type,
  is_original boolean
);

create or replace function data_sources_quota_used(source data_sources)
  returns setof quota_details
  language sql
  security definer
  stable as $$
    select
      size as bytes,
      id,
      type,
      is_original
    from
      data_upload_outputs
    where
      data_source_id = source.id;
  $$;

grant execute on function data_sources_quota_used to seasketch_user;
comment on function data_sources_quota_used is '@simpleCollections only';
