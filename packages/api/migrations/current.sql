-- Selective overlay publishing.
-- Partial publish copies a chosen set of draft TOC items onto the published
-- tree. It does not publish sort_index or z_index. Full publish still replaces
-- the tree, including order.
--
-- published_at is the per-item "what is still unpublished" boundary. It is
-- written by the publish INSERT statements (clock_timestamp()), not by a
-- trigger. Existing published rows are backfilled from
-- projects.table_of_contents_last_published so production data keeps today's
-- pending-change behavior.
--
-- Publish sets seasketch.publishing so the per-row triggers that would
-- otherwise repeat the same project update, activity job, and validation
-- query for every copied layer return immediately. The publish statements
-- do that work once.

alter table public.table_of_contents_items
  add column if not exists published_at timestamp with time zone;

comment on column public.table_of_contents_items.published_at is
  'When this published row was written. Null on draft rows. Pending edits are changelog rows newer than the published counterpart.';

drop trigger if exists trg_toc_stamp_published_at on public.table_of_contents_items;
drop function if exists public.trg_toc_stamp_published_at();

-- Skip per-row work while a publish is copying or deleting the published tree.
do $$
declare
  fn text;
  ret text;
  src text;
  next text;
begin
  for fn, ret in
    select * from (values
      ('public.table_of_contents_items_project_update()', 'NEW'),
      ('public.record_project_activity_on_delete()', 'OLD'),
      ('public.after_data_layers_update_or_delete_set_draft_table_of_contents_()', 'NEW'),
      ('public.after_data_sources_update_or_delete_set_draft_table_of_contents()', 'NEW'),
      ('public.acl_update_draft_toc_has_changes()', 'NEW'),
      ('public.before_insert_or_update_data_layers_trigger()', 'NEW'),
      ('public.before_insert_or_update_data_sources_trigger()', 'NEW'),
      ('public.before_layer_insert_create_interactivity_settings_func()', 'NEW'),
      ('public.trg_changelog_data_layers_data_source_layer_uploaded()', 'NEW'),
      ('public.trg_changelog_table_of_contents_items_insert_created()', 'NEW'),
      ('public.trg_changelog_table_of_contents_items_insert_layer_uploaded()', 'NEW'),
      ('public.after_deleted__data_upload_outputs()', 'OLD')
    ) as t(fn, ret)
  loop
    src := pg_get_functiondef(fn::regprocedure);
    if src like '%publishing-bailout%' then
      continue;
    end if;
    next := regexp_replace(
      src,
      '\ybegin\y',
      format(E'begin\n  -- publishing-bailout\n  if coalesce(current_setting(''seasketch.publishing'', true), '''') = ''true'' then\n    return %s;\n  end if;', ret),
      'i'
    );
    if next = src then
      raise exception 'failed to patch % for publish bailout', fn;
    end if;
    execute next;
  end loop;
end $$;

-- Published copies already carry data_source_type and original_source_upload_available.
-- Returning here also lets publish rewrite path on published descendants.
do $$
declare
  src text;
  next text;
begin
  src := pg_get_functiondef('public.before_insert_or_update_table_of_contents_items_trigger()'::regprocedure);
  if src like '%publishing-bailout%' then
    return;
  end if;
  next := regexp_replace(
    src,
    '\ybegin\y',
    E'begin\n  -- publishing-bailout\n  if coalesce(current_setting(''seasketch.publishing'', true), '''') = ''true'' and new.is_draft = false then\n    return new;\n  end if;',
    'i'
  );
  if next = src then
    raise exception 'failed to patch toc before trigger for publish bailout';
  end if;
  execute next;
end $$;

-- Backfill under the bailout so this update does not mark every project unpublished
-- and does not run the per-row immutability lookups.
select set_config('seasketch.publishing', 'true', true);
update public.table_of_contents_items t
set published_at = p.table_of_contents_last_published
from public.projects p
where p.id = t.project_id
  and t.is_draft = false
  and t.published_at is null
  and p.table_of_contents_last_published is not null;
select set_config('seasketch.publishing', 'false', true);

-- Serialize full and partial publishes, skip per-row triggers, and stamp
-- published_at in the insert instead of a trigger. Copy bucket_id/object_key
-- because the source insert trigger no longer fills them during publish.
do $$
declare
  src text;
  next text;
begin
  src := pg_get_functiondef('public.publish_table_of_contents(integer)'::regprocedure);
  next := src;
  if next not like '%publish_toc:%' then
    next := replace(
      next,
      'if session_is_admin("projectId") = false then',
      'perform set_config(''seasketch.publishing'', ''true'', true);
  perform pg_advisory_xact_lock(hashtext(''publish_toc:'' || "projectId"::text));
  if session_is_admin("projectId") = false then'
    );
  elsif next not like '%seasketch.publishing%' then
    next := replace(
      next,
      'perform pg_advisory_xact_lock(hashtext(''publish_toc:'' || "projectId"::text));',
      'perform set_config(''seasketch.publishing'', ''true'', true);
  perform pg_advisory_xact_lock(hashtext(''publish_toc:'' || "projectId"::text));'
    );
  end if;
  if next not like '%clock_timestamp()%' then
    next := replace(
      next,
      'hide_arcgis_rest_link
    ) values (',
      'hide_arcgis_rest_link,
      data_source_type,
      original_source_upload_available,
      published_at
    ) values ('
    );
    next := replace(
      next,
      'item.hide_arcgis_rest_link
    ) returning id into new_toc_id;',
      'item.hide_arcgis_rest_link,
      item.data_source_type,
      item.original_source_upload_available,
      clock_timestamp()
    ) returning id into new_toc_id;'
    );
  end if;
  if next not like '%bucket_id,%' then
    next := replace(
      next,
      'temporal,
      created_by
    )
      select
        "projectId",',
      'temporal,
      created_by,
      bucket_id,
      object_key
    )
      select
        "projectId",'
    );
    next := replace(
      next,
      'temporal,
      created_by
      from
        data_sources',
      'temporal,
      created_by,
      bucket_id,
      object_key
      from
        data_sources'
    );
  end if;
  if next not like '%set_config(''seasketch.publishing'', ''false''%' then
    next := replace(
      next,
      '-- return items',
      'perform set_config(''seasketch.publishing'', ''false'', true);
  -- return items'
    );
  end if;
  if next is distinct from src then
    execute next;
  end if;
  if next not like '%publish_toc:%'
     or next not like '%clock_timestamp()%'
     or next not like '%bucket_id,%'
     or next not like '%set_config(''seasketch.publishing'', ''false''%' then
    raise exception 'publish_table_of_contents patch incomplete';
  end if;
end $$;

drop function if exists public._publish_place_ids(text[], text[], text[]);

drop function if exists public.projects_pending_publish_items(public.projects);
drop function if exists public.pending_publish_items_for_project(integer);
drop type if exists public.pending_publish_item;
create type public.pending_publish_item as (
  stable_id text,
  kind text,
  title text,
  is_folder boolean,
  parent_stable_id text,
  path text,
  requires_stable_ids text[],
  bundle_id text,
  draft_id integer,
  included_in_bundle boolean
);

create or replace function public.pending_publish_items_for_project(p_project_id integer)
  returns setof public.pending_publish_item
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  with recursive draft as (
    select *
    from table_of_contents_items
    where project_id = p_project_id and is_draft
  ),
  published as (
    select *
    from table_of_contents_items
    where project_id = p_project_id and not is_draft
  ),
  pending_log_items as (
    select d.stable_id
    from draft d
    left join published p
      on p.project_id = d.project_id and p.stable_id = d.stable_id
    where exists (
      select 1
      from change_logs cl
      where cl.project_id = p_project_id
        and cl.net_zero_changes = false
        and cl.field_group::text not in (
          'layers:published',
          'layers:z-order-change'
        )
        and cl.field_group::text not like 'resolvable_layer_comments:%'
        and (
          p.id is null
          or cl.last_at > coalesce(p.published_at, '-infinity'::timestamptz)
        )
        and (
          (cl.entity_type = 'table_of_contents_items' and cl.entity_id = d.id)
          or (
            cl.meta ? 'table_of_contents_item_id'
            and (cl.meta->>'table_of_contents_item_id') ~ '^[0-9]+$'
            and (cl.meta->>'table_of_contents_item_id')::int = d.id
          )
        )
        and not (
          cl.field_group::text in ('layer:attribution', 'layer:temporal')
          and exists (
            select 1
            from data_layers dl
            join data_sources ds on ds.id = dl.data_source_id
            where dl.id = d.data_layer_id
              and ds.data_library_template_id is not null
          )
        )
    )
  ),
  units as (
    select
      d.stable_id,
      'added'::text as kind,
      d.title,
      d.is_folder,
      d.parent_stable_id,
      d.path,
      d.id as draft_id,
      null::ltree as pub_path
    from draft d
    where not exists (
      select 1 from published p where p.stable_id = d.stable_id
    )
    union all
    select
      p.stable_id,
      'removed'::text,
      p.title,
      p.is_folder,
      p.parent_stable_id,
      p.path,
      null::int,
      p.path
    from published p
    where not exists (
      select 1 from draft d where d.stable_id = p.stable_id
    )
    union all
    select
      d.stable_id,
      'updated'::text,
      d.title,
      d.is_folder,
      d.parent_stable_id,
      d.path,
      d.id,
      p.path
    from draft d
    join published p
      on p.project_id = d.project_id and p.stable_id = d.stable_id
    where d.parent_stable_id is distinct from p.parent_stable_id
      or d.stable_id in (select stable_id from pending_log_items)
      or exists (
        select 1
        from data_layers dd
        join data_layers pd on pd.id = p.data_layer_id
        join data_sources ds on ds.id = dd.data_source_id
        join data_sources ps on ps.id = pd.data_source_id
        where dd.id = d.data_layer_id
          and ds.data_library_template_id is null
          and (
            ds.url is distinct from ps.url
            or ds.attribution is distinct from ps.attribution
            or ds.temporal is distinct from ps.temporal
            or dd.mapbox_gl_styles is distinct from pd.mapbox_gl_styles
            or dd.render_under is distinct from pd.render_under
            or dd.source_layer is distinct from pd.source_layer
            or dd.sublayer is distinct from pd.sublayer
            or dd.sublayer_type is distinct from pd.sublayer_type
          )
      )
  ),
  ancestors as (
    select u.stable_id as unit_id, d.parent_stable_id as ancestor_id
    from units u
    join draft d on d.stable_id = u.stable_id
    where u.kind in ('added', 'updated')
      and d.parent_stable_id is not null
    union all
    select a.unit_id, d.parent_stable_id
    from ancestors a
    join draft d on d.stable_id = a.ancestor_id
    where d.parent_stable_id is not null
  ),
  added_requires as (
    select a.unit_id, array_agg(distinct a.ancestor_id) as reqs
    from ancestors a
    join units u on u.stable_id = a.ancestor_id and u.kind = 'added'
    group by a.unit_id
  ),
  removal_requires as (
    select folder.stable_id as unit_id, array_agg(distinct child.stable_id) as reqs
    from units folder
    join published folder_row on folder_row.stable_id = folder.stable_id
    join published child
      on folder_row.path @> child.path
     and child.stable_id <> folder.stable_id
    join draft moved on moved.stable_id = child.stable_id
    where folder.kind = 'removed'
      and folder.is_folder
    group by folder.stable_id
  ),
  with_requires as (
    select
      u.*,
      coalesce(ar.reqs, rr.reqs, '{}'::text[]) as requires_stable_ids
    from units u
    left join added_requires ar on ar.unit_id = u.stable_id
    left join removal_requires rr on rr.unit_id = u.stable_id
  ),
  removal_top as (
    select
      u.stable_id,
      (
        select a.stable_id
        from published self
        join published a
          on a.is_folder
         and a.path @> self.path
         and a.stable_id in (select stable_id from units where kind = 'removed')
        where self.stable_id = u.stable_id
        order by nlevel(a.path)
        limit 1
      ) as top_id
    from with_requires u
    where u.kind = 'removed'
  ),
  source_members as (
    select u.stable_id, dl.data_source_id
    from with_requires u
    join draft d on d.stable_id = u.stable_id
    join data_layers dl on dl.id = d.data_layer_id
    join data_sources ds
      on ds.id = dl.data_source_id
     and ds.data_library_template_id is null
    where u.kind in ('added', 'updated')
      and exists (
        select 1
        from change_logs cl
        join draft d2
          on cl.entity_type = 'table_of_contents_items'
         and cl.entity_id = d2.id
        join data_layers dl2
          on dl2.id = d2.data_layer_id
         and dl2.data_source_id = dl.data_source_id
        left join published p2
          on p2.project_id = d2.project_id
         and p2.stable_id = d2.stable_id
        where cl.project_id = p_project_id
          and cl.net_zero_changes = false
          and cl.field_group::text in ('layer:attribution', 'layer:temporal')
          and (
            p2.id is null
            or cl.last_at > coalesce(p2.published_at, '-infinity'::timestamptz)
          )
          and d2.stable_id in (
            select stable_id from with_requires where kind in ('added', 'updated')
          )
      )
  ),
  source_bundles as (
    select data_source_id
    from source_members
    group by data_source_id
    having count(*) > 1
  ),
  bundled as (
    select
      w.stable_id,
      w.kind,
      w.title,
      w.is_folder,
      w.parent_stable_id,
      w.path::text as path,
      w.requires_stable_ids,
      w.draft_id,
      case
        when rt.top_id is not null and (
          rt.top_id <> w.stable_id
          or exists (
            select 1
            from with_requires c
            join published cp on cp.stable_id = c.stable_id
            join published self on self.stable_id = w.stable_id
            where c.kind = 'removed'
              and c.stable_id <> w.stable_id
              and self.path @> cp.path
          )
        ) then rt.top_id
        when sb.data_source_id is not null then 'source:' || sb.data_source_id::text
        else null
      end as bundle_id,
      case
        when rt.top_id is not null and rt.top_id <> w.stable_id then true
        when sb.data_source_id is not null and w.stable_id <> (
          select min(sm.stable_id)
          from source_members sm
          where sm.data_source_id = sb.data_source_id
        ) then true
        else false
      end as included_in_bundle
    from with_requires w
    left join removal_top rt on rt.stable_id = w.stable_id
    left join source_members sm on sm.stable_id = w.stable_id
    left join source_bundles sb on sb.data_source_id = sm.data_source_id
      and rt.top_id is null
  )
  select
    b.stable_id,
    b.kind,
    b.title,
    b.is_folder,
    b.parent_stable_id,
    b.path,
    (
      select coalesce(array_agg(distinct r), '{}'::text[])
      from (
        select unnest(b.requires_stable_ids) as r
        union
        select unnest(m.requires_stable_ids)
        from bundled m
        where b.bundle_id is not null
          and m.bundle_id = b.bundle_id
      ) reqs
      where r is not null and r <> ''
    ) as requires_stable_ids,
    b.bundle_id,
    b.draft_id,
    b.included_in_bundle
  from bundled b
  order by b.kind, b.path, b.stable_id;
$$;

comment on function public.pending_publish_items_for_project(integer) is '@omit';
revoke all on function public.pending_publish_items_for_project(integer) from public;

create or replace function public.projects_pending_publish_items(project public.projects)
  returns setof public.pending_publish_item
  language plpgsql
  stable
  security definer
  set search_path to public, pg_temp
as $$
begin
  if session_is_admin(project.id) = false then
    raise 'Permission denied. Must be a project admin';
  end if;
  return query
    select * from public.pending_publish_items_for_project(project.id);
end;
$$;

comment on function public.projects_pending_publish_items(public.projects) is '@simpleCollections only';

create or replace function public.layer_stack_order_pending(p_project_id integer)
  returns boolean
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  with common as (
    select
      d.stable_id,
      dd.z_index as draft_z,
      pd.z_index as pub_z
    from table_of_contents_items d
    join table_of_contents_items p
      on p.project_id = d.project_id
     and p.stable_id = d.stable_id
     and not p.is_draft
    join data_layers dd on dd.id = d.data_layer_id
    join data_layers pd on pd.id = p.data_layer_id
    where d.project_id = p_project_id
      and d.is_draft
      and not d.is_folder
  ),
  draft_order as (
    select coalesce(array_agg(stable_id order by draft_z, stable_id), '{}'::text[]) as ids
    from common
  ),
  pub_order as (
    select coalesce(array_agg(stable_id order by pub_z, stable_id), '{}'::text[]) as ids
    from common
  )
  select draft_order.ids is distinct from pub_order.ids
  from draft_order, pub_order;
$$;

comment on function public.layer_stack_order_pending(integer) is '@omit';
revoke all on function public.layer_stack_order_pending(integer) from public;

create or replace function public.projects_layer_stack_order_pending(project public.projects)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to public, pg_temp
as $$
begin
  if session_is_admin(project.id) = false then
    raise 'Permission denied. Must be a project admin';
  end if;
  return public.layer_stack_order_pending(project.id);
end;
$$;

create or replace function public.overlay_list_has_unpublished_changes(p_project_id integer)
  returns boolean
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  with draft as (
    select * from table_of_contents_items
    where project_id = p_project_id and is_draft
  ),
  published as (
    select * from table_of_contents_items
    where project_id = p_project_id and not is_draft
  )
  select
    exists (
      select stable_id from draft
      except
      select stable_id from published
    )
    or exists (
      select stable_id from published
      except
      select stable_id from draft
    )
    or exists (
      select 1
      from draft d
      join published p on p.stable_id = d.stable_id
      where d.title is distinct from p.title
         or d.parent_stable_id is distinct from p.parent_stable_id
         or d.metadata is distinct from p.metadata
         or d.bounds is distinct from p.bounds
         or d.hide_children is distinct from p.hide_children
         or d.show_radio_children is distinct from p.show_radio_children
         or d.is_click_off_only is distinct from p.is_click_off_only
         or d.enable_download is distinct from p.enable_download
         or d.enable_data_tables is distinct from p.enable_data_tables
         or d.data_table_join_column is distinct from p.data_table_join_column
         or d.translated_props is distinct from p.translated_props
         or d.geoprocessing_reference_id is distinct from p.geoprocessing_reference_id
         or d.hide_arcgis_rest_link is distinct from p.hide_arcgis_rest_link
         or d.copied_from_data_library_template_id is distinct from p.copied_from_data_library_template_id
    )
    or exists (
      select 1
      from (
        select parent_stable_id
        from draft
        intersect
        select parent_stable_id
        from published
      ) parents
      where (
        select coalesce(array_agg(d.stable_id order by d.sort_index, d.stable_id), '{}'::text[])
        from draft d
        where d.parent_stable_id is not distinct from parents.parent_stable_id
          and exists (select 1 from published p where p.stable_id = d.stable_id)
      ) is distinct from (
        select coalesce(array_agg(p.stable_id order by p.sort_index, p.stable_id), '{}'::text[])
        from published p
        where p.parent_stable_id is not distinct from parents.parent_stable_id
          and exists (select 1 from draft d where d.stable_id = p.stable_id)
      )
    )
    or public.layer_stack_order_pending(p_project_id)
    or exists (
      select 1
      from draft d
      join published p on p.stable_id = d.stable_id
      join data_layers dd on dd.id = d.data_layer_id
      join data_layers pd on pd.id = p.data_layer_id
      where dd.mapbox_gl_styles is distinct from pd.mapbox_gl_styles
         or dd.render_under is distinct from pd.render_under
         or dd.source_layer is distinct from pd.source_layer
         or dd.sublayer is distinct from pd.sublayer
         or dd.sublayer_type is distinct from pd.sublayer_type
    )
    or exists (
      select 1
      from draft d
      join published p on p.stable_id = d.stable_id
      join data_layers dd on dd.id = d.data_layer_id
      join data_layers pd on pd.id = p.data_layer_id
      join interactivity_settings di on di.id = dd.interactivity_settings_id
      join interactivity_settings pi on pi.id = pd.interactivity_settings_id
      where di.type is distinct from pi.type
         or di.short_template is distinct from pi.short_template
         or di.long_template is distinct from pi.long_template
         or di.cursor is distinct from pi.cursor
         or di.title is distinct from pi.title
         or di.layers is distinct from pi.layers
    )
    or exists (
      select 1
      from draft d
      join published p on p.stable_id = d.stable_id
      join access_control_lists da on da.table_of_contents_item_id = d.id
      join access_control_lists pa on pa.table_of_contents_item_id = p.id
      where da.type is distinct from pa.type
         or (
           select coalesce(array_agg(g.group_id order by g.group_id), '{}'::int[])
           from access_control_list_groups g
           where g.access_control_list_id = da.id
         ) is distinct from (
           select coalesce(array_agg(g.group_id order by g.group_id), '{}'::int[])
           from access_control_list_groups g
           where g.access_control_list_id = pa.id
         )
    )
    or exists (
      select 1
      from draft d
      join published p on p.stable_id = d.stable_id and not d.is_folder
      join data_layers dd on dd.id = d.data_layer_id
      join data_layers pd on pd.id = p.data_layer_id
      join data_sources ds on ds.id = dd.data_source_id
      join data_sources ps on ps.id = pd.data_source_id
      where ds.data_library_template_id is null
        and (
          ds.attribution is distinct from ps.attribution
          or ds.temporal is distinct from ps.temporal
          or ds.url is distinct from ps.url
          or ds.bounds is distinct from ps.bounds
          or ds.minzoom is distinct from ps.minzoom
          or ds.maxzoom is distinct from ps.maxzoom
          or ds.tiles is distinct from ps.tiles
          or ds.geostats is distinct from ps.geostats
          or ds.query_parameters is distinct from ps.query_parameters
          or ds.scheme is distinct from ps.scheme
          or ds.encoding is distinct from ps.encoding
          or ds.tile_size is distinct from ps.tile_size
          or ds.buffer is distinct from ps.buffer
          or ds.cluster is distinct from ps.cluster
          or ds.cluster_max_zoom is distinct from ps.cluster_max_zoom
          or ds.cluster_properties is distinct from ps.cluster_properties
          or ds.cluster_radius is distinct from ps.cluster_radius
          or ds.coordinates is distinct from ps.coordinates
          or ds.urls is distinct from ps.urls
        )
    )
    or exists (
      select 1
      from draft d
      join published p on p.stable_id = d.stable_id
      where (
        select coalesce(
          jsonb_agg(jsonb_build_object('s', odt.stable_id, 'v', odt.version, 'n', odt.name) order by odt.stable_id),
          '[]'::jsonb
        )
        from overlay_data_tables odt
        where odt.table_of_contents_item_id = d.id and odt.deleted_at is null
      ) is distinct from (
        select coalesce(
          jsonb_agg(jsonb_build_object('s', odt.stable_id, 'v', odt.version, 'n', odt.name) order by odt.stable_id),
          '[]'::jsonb
        )
        from overlay_data_tables odt
        where odt.table_of_contents_item_id = p.id and odt.deleted_at is null
      )
    );
$$;

comment on function public.overlay_list_has_unpublished_changes(integer) is '@omit';
revoke all on function public.overlay_list_has_unpublished_changes(integer) from public;

create or replace function public.projects_change_logs_since_last_publish(project public.projects)
  returns setof public.change_logs
  language plpgsql
  stable
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_last_publish timestamp;
begin
  if session_is_admin(project.id) = false then
    raise 'Permission denied. Must be a project admin';
  end if;
  select table_of_contents_last_published into v_last_publish
  from projects where id = project.id;
  if v_last_publish is null then
    return query
      select *
      from change_logs
      where project_id = project.id
        and net_zero_changes = false
        and field_group <> 'layers:published'
        and session_is_admin(project_id)
      order by last_at desc;
    return;
  end if;
  return query
    select *
    from change_logs cl
    where cl.project_id = project.id
      and cl.net_zero_changes = false
      and cl.field_group <> 'layers:published'
      and cl.last_at > v_last_publish
      and (
        cl.field_group = 'layers:z-order-change'
        or (
          cl.entity_type = 'table_of_contents_items'
          and cl.field_group not in ('layer:deleted', 'folder:deleted')
          and exists (
            select 1
            from table_of_contents_items d
            left join table_of_contents_items p
              on p.project_id = d.project_id
             and not p.is_draft
             and p.stable_id = d.stable_id
            where d.id = cl.entity_id
              and d.project_id = cl.project_id
              and d.is_draft
              and (
                p.id is null
                or cl.last_at > coalesce(p.published_at, '-infinity'::timestamptz)
              )
          )
        )
        or (
          cl.meta ? 'table_of_contents_item_id'
          and (cl.meta->>'table_of_contents_item_id') ~ '^[0-9]+$'
          and exists (
            select 1
            from table_of_contents_items d
            left join table_of_contents_items p
              on p.project_id = d.project_id
             and not p.is_draft
             and p.stable_id = d.stable_id
            where d.id = (cl.meta->>'table_of_contents_item_id')::int
              and d.project_id = cl.project_id
              and d.is_draft
              and (
                p.id is null
                or cl.last_at > coalesce(p.published_at, '-infinity'::timestamptz)
              )
          )
        )
        or (
          cl.field_group in ('layer:deleted', 'folder:deleted')
          and exists (
            select 1
            from table_of_contents_items p
            where p.project_id = cl.project_id
              and not p.is_draft
              and not exists (
                select 1
                from table_of_contents_items d
                where d.project_id = p.project_id
                  and d.is_draft
                  and d.stable_id = p.stable_id
              )
              and p.title = cl.from_summary->>'title'
              and p.is_folder = (cl.field_group = 'folder:deleted')
              and cl.last_at > coalesce(p.published_at, '-infinity'::timestamptz)
          )
        )
      )
    order by cl.last_at desc;
end;
$$;

comment on function public.projects_change_logs_since_last_publish(public.projects) is '@simpleCollections only';

create or replace function public.projects_comments_since_last_publish(project public.projects)
  returns setof public.resolvable_layer_comments
  language plpgsql
  stable
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_last_publish timestamp;
begin
  if session_is_admin(project.id) = false then
    raise exception 'Access denied to project %', project.id;
  end if;
  select table_of_contents_last_published into v_last_publish
  from projects where id = project.id;
  return query
    select c.*
    from resolvable_layer_comments c
    where c.project_id = project.id
      and c.parent_comment_id is null
      and (c.resolved_at > v_last_publish or c.created_at > v_last_publish)
      and not exists (
        select 1
        from table_of_contents_items d
        join table_of_contents_items p
          on p.project_id = d.project_id
         and not p.is_draft
         and p.stable_id = d.stable_id
        where d.id = c.table_of_contents_item_id
          and d.is_draft
          and p.published_at is not null
          and c.created_at <= p.published_at
          and (c.resolved_at is null or c.resolved_at <= p.published_at)
      );
end;
$$;

comment on function public.projects_comments_since_last_publish(public.projects) is '@simpleCollections only';

create or replace function public._unpublish_toc_stable_id(p_project_id integer, p_stable_id text)
  returns void
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_toc_id int;
  v_layer_id int;
  v_source_id int;
  v_interactivity_id int;
  v_library text;
begin
  select id, data_layer_id
    into v_toc_id, v_layer_id
  from table_of_contents_items
  where project_id = p_project_id
    and not is_draft
    and stable_id = p_stable_id;
  if v_toc_id is null then
    return;
  end if;
  if v_layer_id is not null then
    select data_source_id, interactivity_settings_id
      into v_source_id, v_interactivity_id
    from data_layers
    where id = v_layer_id;
  end if;
  delete from table_of_contents_items where id = v_toc_id;
  if v_layer_id is not null then
    delete from data_layers where id = v_layer_id;
    if v_interactivity_id is not null then
      delete from interactivity_settings where id = v_interactivity_id;
    end if;
    if v_source_id is not null then
      select data_library_template_id into v_library
      from data_sources where id = v_source_id;
      if v_library is null
         and not exists (
           select 1 from data_layers where data_source_id = v_source_id
         ) then
        delete from data_sources where id = v_source_id;
      end if;
    end if;
  end if;
end;
$$;

comment on function public._unpublish_toc_stable_id(integer, text) is '@omit';
revoke all on function public._unpublish_toc_stable_id(integer, text) from public;

drop function if exists public._publish_copy_draft_toc_item(integer);

create or replace function public._publish_copy_draft_toc_item(
  p_draft_id integer,
  p_sort_index integer,
  p_z_index integer
)
  returns table(new_toc_id integer, new_layer_id integer, draft_source_id integer)
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  item table_of_contents_items;
  v_path ltree;
  v_parent_draft_path ltree;
  v_parent_published_path ltree;
  v_interactivity_id int;
  v_layer_id int;
  v_source_id int;
  v_library text;
  acl_type access_control_list_type;
  acl_id int;
  orig_acl_id int;
begin
  select * into item from table_of_contents_items where id = p_draft_id and is_draft;
  if item.id is null then
    raise 'Draft table of contents item % not found', p_draft_id;
  end if;

  -- Partial publish does not ship list order. An existing published row keeps
  -- its sort_index and z_index. A new row is appended.
  if p_sort_index is null then
    select coalesce(max(sort_index), -1) + 1 into p_sort_index
    from table_of_contents_items
    where project_id = item.project_id
      and not is_draft
      and parent_stable_id is not distinct from item.parent_stable_id;
  end if;

  if item.parent_stable_id is null then
    v_path := item.path;
  else
    select path into v_parent_draft_path
    from table_of_contents_items
    where project_id = item.project_id
      and is_draft
      and stable_id = item.parent_stable_id;
    select path into v_parent_published_path
    from table_of_contents_items
    where project_id = item.project_id
      and not is_draft
      and stable_id = item.parent_stable_id;
    if v_parent_published_path is null or v_parent_draft_path is null then
      raise 'Published parent % is missing for %', item.parent_stable_id, item.stable_id;
    end if;
    v_path := v_parent_published_path || subpath(item.path, nlevel(v_parent_draft_path));
  end if;

  v_layer_id := null;
  v_source_id := null;
  if item.is_folder = false then
    select data_source_id into v_source_id
    from data_layers where id = item.data_layer_id;
    select data_library_template_id into v_library
    from data_sources where id = v_source_id;

    if p_z_index is null then
      select coalesce(max(dl.z_index), 0) + 1 into p_z_index
      from data_layers dl
      join table_of_contents_items t on t.data_layer_id = dl.id
      where t.project_id = item.project_id
        and not t.is_draft;
    end if;

    insert into interactivity_settings (
      type, short_template, long_template, cursor, title
    )
    select type, short_template, long_template, cursor, title
    from interactivity_settings
    where id = (
      select interactivity_settings_id from data_layers where id = item.data_layer_id
    )
    returning id into v_interactivity_id;

    insert into data_layers (
      project_id,
      data_source_id,
      source_layer,
      sublayer,
      sublayer_type,
      render_under,
      mapbox_gl_styles,
      interactivity_settings_id,
      z_index
    )
    select
      item.project_id,
      data_source_id,
      source_layer,
      sublayer,
      sublayer_type,
      render_under,
      mapbox_gl_styles,
      v_interactivity_id,
      p_z_index
    from data_layers
    where id = item.data_layer_id
    returning id into v_layer_id;
  end if;

  insert into table_of_contents_items (
    is_draft,
    project_id,
    path,
    stable_id,
    parent_stable_id,
    title,
    is_folder,
    show_radio_children,
    is_click_off_only,
    metadata,
    bounds,
    data_layer_id,
    sort_index,
    hide_children,
    geoprocessing_reference_id,
    translated_props,
    enable_download,
    enable_data_tables,
    data_table_join_column,
    copied_from_data_library_template_id,
    hide_arcgis_rest_link,
    data_source_type,
    original_source_upload_available,
    published_at
  ) values (
    false,
    item.project_id,
    v_path,
    item.stable_id,
    item.parent_stable_id,
    item.title,
    item.is_folder,
    item.show_radio_children,
    item.is_click_off_only,
    item.metadata,
    item.bounds,
    coalesce(v_layer_id, item.data_layer_id),
    p_sort_index,
    item.hide_children,
    item.geoprocessing_reference_id,
    item.translated_props,
    item.enable_download,
    item.enable_data_tables,
    item.data_table_join_column,
    item.copied_from_data_library_template_id,
    item.hide_arcgis_rest_link,
    item.data_source_type,
    item.original_source_upload_available,
    clock_timestamp()
  )
  returning id into new_toc_id;

  new_layer_id := v_layer_id;
  draft_source_id := case when v_library is null then v_source_id else null end;

  select type, id into acl_type, orig_acl_id
  from access_control_lists
  where table_of_contents_item_id = item.id;
  if acl_type is not null and acl_type <> 'public' then
    update access_control_lists
    set type = acl_type
    where table_of_contents_item_id = new_toc_id
    returning id into acl_id;
    if acl_type = 'group' then
      insert into access_control_list_groups (access_control_list_id, group_id)
      select acl_id, group_id
      from access_control_list_groups
      where access_control_list_id = orig_acl_id;
    end if;
  end if;

  insert into overlay_data_tables (
    table_of_contents_item_id,
    project_id,
    name,
    join_column,
    overlay_join_column,
    row_count,
    created_by,
    version,
    parquet_remote,
    parquet_url,
    column_stats_remote,
    visualization_columns,
    visualization_ops,
    calculation_mode,
    additional_replicate_identifiers,
    replicate_label,
    replicate_label_custom,
    within_replicate_operations,
    across_replicate_operations,
    subject_column,
    observation_detail_columns,
    coverage_mode,
    coverage_remote,
    effort_marker_values,
    excluded_values,
    required_filter_columns,
    hidden_filter_columns,
    filter_column_labels,
    temporal,
    organism,
    nodata_values,
    source_parquet_remote,
    stable_id,
    description
  )
  select
    new_toc_id,
    odt.project_id,
    odt.name,
    odt.join_column,
    odt.overlay_join_column,
    odt.row_count,
    odt.created_by,
    odt.version,
    odt.parquet_remote,
    odt.parquet_url,
    odt.column_stats_remote,
    odt.visualization_columns,
    odt.visualization_ops,
    odt.calculation_mode,
    odt.additional_replicate_identifiers,
    odt.replicate_label,
    odt.replicate_label_custom,
    odt.within_replicate_operations,
    odt.across_replicate_operations,
    odt.subject_column,
    odt.observation_detail_columns,
    odt.coverage_mode,
    odt.coverage_remote,
    odt.effort_marker_values,
    odt.excluded_values,
    odt.required_filter_columns,
    odt.hidden_filter_columns,
    odt.filter_column_labels,
    odt.temporal,
    odt.organism,
    odt.nodata_values,
    odt.source_parquet_remote,
    odt.stable_id,
    odt.description
  from overlay_data_tables odt
  where odt.table_of_contents_item_id = item.id
    and odt.deleted_at is null;

  return next;
end;
$$;

comment on function public._publish_copy_draft_toc_item(integer, integer, integer) is '@omit';
revoke all on function public._publish_copy_draft_toc_item(integer, integer, integer) from public;

drop function if exists public.publish_table_of_contents_items(integer, text[], boolean);

create or replace function public.publish_table_of_contents_items(
  "projectId" integer,
  "stableIds" text[]
) returns setof public.table_of_contents_items
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_editor int;
  v_layer_count int;
  v_sel text[];
  v_next text[];
  v_row record;
  v_copied_toc int;
  v_copied_layer int;
  v_copied_source int;
  v_layer_ids int[] := '{}'::int[];
  v_source_ids int[] := '{}'::int[];
  v_distinct_sources int[];
  v_source int;
  v_new_source int;
  v_kept_sort int;
  v_kept_z int;
  v_did_work boolean := false;
  v_old_path ltree;
  v_new_path ltree;
  v_folder text;
begin
  perform pg_advisory_xact_lock(hashtext('publish_toc:' || "projectId"::text));
  if session_is_admin("projectId") = false then
    raise 'Permission denied. Must be a project admin';
  end if;
  perform set_config('seasketch.publishing', 'true', true);

  drop table if exists _units;
  drop table if exists _pub_before;
  create temp table _units on commit drop as
    select * from public.pending_publish_items_for_project("projectId");
  create temp table _pub_before on commit drop as
    select stable_id, parent_stable_id, sort_index, path
    from table_of_contents_items
    where project_id = "projectId" and not is_draft;

  v_sel := coalesce((
    select array_agg(distinct stable_id)
    from _units
    where stable_id = any(coalesce("stableIds", '{}'::text[]))
  ), '{}'::text[]);

  loop
    select coalesce(array_agg(distinct x), '{}'::text[]) into v_next
    from (
      select unnest(v_sel) as x
      union
      select unnest(u.requires_stable_ids)
      from _units u
      where u.stable_id = any(v_sel)
      union
      select u2.stable_id
      from _units u
      join _units u2
        on u.bundle_id is not null
       and u2.bundle_id = u.bundle_id
      where u.stable_id = any(v_sel)
    ) s
    where x is not null and x <> '';
    exit when v_next <@ v_sel and v_sel <@ v_next;
    v_sel := v_next;
  end loop;

  for v_row in
    select u.stable_id
    from _units u
    join table_of_contents_items p
      on p.project_id = "projectId"
     and not p.is_draft
     and p.stable_id = u.stable_id
    where u.kind = 'removed'
      and u.stable_id = any(v_sel)
    order by nlevel(p.path) desc
  loop
    perform public._unpublish_toc_stable_id("projectId", v_row.stable_id);
    v_did_work := true;
  end loop;

  for v_row in
    select d.id as draft_id, d.stable_id
    from _units u
    join table_of_contents_items d
      on d.project_id = "projectId"
     and d.is_draft
     and d.stable_id = u.stable_id
    where u.kind in ('added', 'updated')
      and u.stable_id = any(v_sel)
    order by nlevel(d.path), d.sort_index, d.stable_id
  loop
    v_kept_sort := null;
    v_kept_z := null;
    select p.sort_index, dl.z_index
      into v_kept_sort, v_kept_z
    from table_of_contents_items p
    left join data_layers dl on dl.id = p.data_layer_id
    where p.project_id = "projectId"
      and not p.is_draft
      and p.stable_id = v_row.stable_id;
    perform public._unpublish_toc_stable_id("projectId", v_row.stable_id);
    select new_toc_id, new_layer_id, draft_source_id
      into v_copied_toc, v_copied_layer, v_copied_source
    from public._publish_copy_draft_toc_item(v_row.draft_id, v_kept_sort, v_kept_z);
    if v_copied_layer is not null and v_copied_source is not null then
      v_layer_ids := v_layer_ids || v_copied_layer;
      v_source_ids := v_source_ids || v_copied_source;
    end if;
    v_did_work := true;
  end loop;

  if cardinality(v_source_ids) > 0 then
    select array_agg(distinct s) into v_distinct_sources
    from unnest(v_source_ids) s
    where s is not null;
    if v_distinct_sources is not null then
      foreach v_source in array v_distinct_sources loop
        if exists (
          select 1 from data_sources
          where id = v_source and data_library_template_id is not null
        ) then
          continue;
        end if;
        insert into data_sources (
          project_id, type, attribution, bounds, maxzoom, minzoom, url, scheme,
          tiles, tile_size, encoding, buffer, cluster, cluster_max_zoom,
          cluster_properties, cluster_radius, generate_id, line_metrics,
          promote_id, tolerance, coordinates, urls, query_parameters,
          use_device_pixel_ratio, import_type, original_source_url,
          enhanced_security, byte_length, supports_dynamic_layers,
          uploaded_source_filename, uploaded_source_layername,
          normalized_source_object_key, normalized_source_bytes, geostats,
          upload_task_id, translated_props, arcgis_fetch_strategy, temporal,
          created_by, bucket_id, object_key
        )
        select
          "projectId", type, attribution, bounds, maxzoom, minzoom, url, scheme,
          tiles, tile_size, encoding, buffer, cluster, cluster_max_zoom,
          cluster_properties, cluster_radius, generate_id, line_metrics,
          promote_id, tolerance, coordinates, urls, query_parameters,
          use_device_pixel_ratio, import_type, original_source_url,
          enhanced_security, byte_length, supports_dynamic_layers,
          uploaded_source_filename, uploaded_source_layername,
          normalized_source_object_key, normalized_source_bytes, geostats,
          upload_task_id, translated_props, arcgis_fetch_strategy, temporal,
          created_by, bucket_id, object_key
        from data_sources
        where id = v_source
        returning id into v_new_source;

        insert into data_upload_outputs (
          data_source_id, project_id, type, created_at, url, remote, is_original,
          size, filename, original_filename, source_processing_job_key, epsg
        )
        select
          v_new_source, project_id, type, created_at, url, remote, is_original,
          size, filename, original_filename, source_processing_job_key, epsg
        from data_upload_outputs
        where data_source_id = v_source;

        update data_layers dl
        set data_source_id = v_new_source
        where dl.id in (
          select t.layer_id
          from unnest(v_layer_ids, v_source_ids) as t(layer_id, source_id)
          where t.source_id = v_source
        );
      end loop;
    end if;
  end if;

  for v_folder in
    select u.stable_id
    from _units u
    where u.stable_id = any(v_sel)
      and u.is_folder
      and u.kind = 'updated'
  loop
    select path into v_old_path from _pub_before where stable_id = v_folder;
    select path into v_new_path
    from table_of_contents_items
    where project_id = "projectId"
      and not is_draft
      and stable_id = v_folder;
    if v_old_path is not null and v_new_path is distinct from v_old_path then
      update table_of_contents_items c
      set path = v_new_path || subpath(c.path, nlevel(v_old_path))
      where c.project_id = "projectId"
        and not c.is_draft
        and c.stable_id <> v_folder
        and v_old_path @> c.path;
    end if;
  end loop;

  perform set_config('seasketch.publishing', 'false', true);

  if v_did_work then
    update projects
    set draft_table_of_contents_has_changes =
      public.overlay_list_has_unpublished_changes("projectId")
    where id = "projectId";

    v_editor := nullif(current_setting('session.user_id', true), '')::int;
    if v_editor is not null then
      select count(*)::int into v_layer_count
      from table_of_contents_items
      where project_id = "projectId"
        and is_draft = true
        and is_folder = false;
      perform record_changelog(
        "projectId",
        v_editor,
        'projects',
        "projectId",
        'layers:published'::change_log_field_group,
        '{}'::jsonb,
        jsonb_build_object('layer_count', v_layer_count),
        null,
        null,
        null
      );
    end if;
  end if;

  return query
    select *
    from table_of_contents_items
    where project_id = "projectId"
      and not is_draft
      and stable_id = any(v_sel);
end;
$$;

comment on function public.publish_table_of_contents_items(integer, text[]) is
  'Publishes the selected draft overlay items (and anything they require) without replacing the rest of the published tree. Does not publish sort_index or z_index.';

grant execute on function public.publish_table_of_contents_items(integer, text[]) to seasketch_user;
grant execute on function public.projects_pending_publish_items(public.projects) to seasketch_user;
grant execute on function public.projects_layer_stack_order_pending(public.projects) to seasketch_user;
