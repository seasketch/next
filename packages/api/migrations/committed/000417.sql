--! Previous: sha1:8ec1b079b735ecd63d94391502c3db11bc29b24b
--! Hash: sha1:81e45138026914cfdedc1fbe696e9e7235b2c6c0

-- Enter migration here
create or replace function table_of_contents_items_related_publish_change_logs(item table_of_contents_items)
  returns setof change_logs
  language sql
  security definer
  stable
  as $$
    with layer_created as (
      select ds.created_at
      from data_layers dl
      inner join data_sources ds on ds.id = dl.data_source_id
      where dl.id = item.data_layer_id
      limit 1
    ),
    publish_logs as (
      select
        p as publish_log,
        (
          select max(prev.last_at)
          from change_logs prev
          where prev.project_id = item.project_id
            and prev.entity_type = 'projects'
            and prev.entity_id = item.project_id
            and prev.field_group = 'layers:published'
            and prev.net_zero_changes = false
            and prev.last_at < p.last_at
        ) as previous_publish_at
      from change_logs p
      cross join layer_created lc
      where p.project_id = item.project_id
        and p.entity_type = 'projects'
        and p.entity_id = item.project_id
        and p.field_group = 'layers:published'
        and p.net_zero_changes = false
        and session_is_admin(p.project_id)
        and p.last_at > lc.created_at
    )
    select (p.publish_log).*
    from publish_logs p
    where exists (
      select 1
      from change_logs c
      where c.project_id = item.project_id
        and c.entity_type = 'table_of_contents_items'
        and c.entity_id = item.id
        and c.net_zero_changes = false
        and c.last_at > coalesce(p.previous_publish_at, '-infinity'::timestamptz)
        and c.last_at <= (p.publish_log).last_at
    )
    order by (p.publish_log).last_at desc;
  $$;

grant execute on function table_of_contents_items_related_publish_change_logs(item table_of_contents_items) to seasketch_user;

comment on function table_of_contents_items_related_publish_change_logs(item table_of_contents_items) is '@simpleCollections only';
