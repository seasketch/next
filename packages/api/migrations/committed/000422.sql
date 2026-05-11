--! Previous: sha1:47dd3717ac881ddd8d91db795649100077c30d06
--! Hash: sha1:9c686743cfb0e7339d0cbaea4cc76059af3793f4

-- undo
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
            select data_layer_id from table_of_contents_items where project_id = p.id and data_layer_id is not null and is_draft = true and data_library_template_id is null and copied_from_data_library_template_id is null
          ) union
          select data_source_id from archived_data_sources where data_source_id = any (
            select id from data_sources where project_id = p.id
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

CREATE OR REPLACE FUNCTION public.table_of_contents_items_quota_used(item public.table_of_contents_items) RETURNS SETOF public.quota_details
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      size as bytes,
      id,
      type,
      is_original,
      false as is_archived
    from
      data_upload_outputs
    where
      data_source_id = (
        select data_source_id from data_layers where id = item.data_layer_id and item.copied_from_data_library_template_id is null and item.data_library_template_id is null
      )
    union all
    select
      size as bytes,
      id,
      type,
      is_original,
      true as is_archived
    from
      data_upload_outputs
    where
      data_source_id in (
        select data_source_id from archived_data_sources where data_layer_id = item.data_layer_id and item.copied_from_data_library_template_id is null and item.data_library_template_id is null
      )
  $$;

CREATE OR REPLACE FUNCTION public.data_layers_total_quota_used(layer public.data_layers) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select coalesce(sum(size), 0)::bigint from data_upload_outputs where data_source_id in (
      select data_source_id from data_layers where id = layer.id
      union all
      select data_source_id from archived_data_sources where data_layer_id = layer.id
    )
  $$;

-- redo
-- Only count upload output bytes for data sources owned by the same project as the
-- draft TOC / layer. Data Library (and other) layers that reference another project's
-- hosted files must not count against this project's quota (issue #920).
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
          select dl.data_source_id
          from data_layers dl
          inner join data_sources ds on ds.id = dl.data_source_id
          where dl.id = any (
            select data_layer_id
            from table_of_contents_items
            where project_id = p.id
              and data_layer_id is not null
              and is_draft = true
          )
          and ds.project_id = p.id
          union
          select data_source_id from archived_data_sources where data_source_id = any (
            select id from data_sources where project_id = p.id
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

CREATE OR REPLACE FUNCTION public.table_of_contents_items_quota_used(item public.table_of_contents_items) RETURNS SETOF public.quota_details
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      size as bytes,
      id,
      type,
      is_original,
      false as is_archived
    from
      data_upload_outputs
    where
      data_source_id = (
        select dl.data_source_id
        from data_layers dl
        inner join data_sources ds on ds.id = dl.data_source_id
        where dl.id = item.data_layer_id
          and ds.project_id = item.project_id
      )
    union all
    select
      size as bytes,
      id,
      type,
      is_original,
      true as is_archived
    from
      data_upload_outputs
    where
      data_source_id in (
        select ads.data_source_id
        from archived_data_sources ads
        inner join data_sources ds on ds.id = ads.data_source_id
        where ads.data_layer_id = item.data_layer_id
          and ds.project_id = item.project_id
      )
  $$;

CREATE OR REPLACE FUNCTION public.data_layers_total_quota_used(layer public.data_layers) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select coalesce(sum(duo.size), 0)::bigint
    from data_upload_outputs duo
    where duo.data_source_id in (
      select dl.data_source_id
      from data_layers dl
      inner join data_sources ds on ds.id = dl.data_source_id
      where dl.id = layer.id
        and ds.project_id = layer.project_id
      union all
      select ads.data_source_id
      from archived_data_sources ads
      inner join data_sources ds on ds.id = ads.data_source_id
      where ads.data_layer_id = layer.id
        and ds.project_id = layer.project_id
    )
  $$;
