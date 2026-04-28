--! Previous: sha1:235b4dd278d55928a7046c504d07e68f39046214
--! Hash: sha1:2c372078e9271ffbd876d95b0a0cfa2b6b6f87c3

create or replace function public.update_z_indexes("dataLayerIds" integer[]) returns setof public.data_layers
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  z int;
  pid int;
  v_editor int;
  v_reordered_count int;
begin
  if (select count(distinct(project_id)) from data_layers where id = any("dataLayerIds")) > 1 then
    raise 'Denied. Attempting to modify more than one project.';
  end if;
  if (session_is_admin((select project_id from data_layers where id = any("dataLayerIds") limit 1))) != true then
    raise 'Unauthorized';
  end if;

  pid := (select project_id from data_layers where id = any("dataLayerIds") limit 1);

  v_reordered_count := coalesce(array_length("dataLayerIds", 1), 0);

  -- Disable triggers to prevent unnecessary checks which could cause
  -- deadlocks if rapidly updating z-indexes on a large number of layers.
  set session_replication_role = replica;
  z = 0;
  for i in array_lower("dataLayerIds", 1)..array_upper("dataLayerIds", 1) loop
    z = z + 1;
    update data_layers set z_index = z where id = "dataLayerIds"[i];
  end loop;
  set session_replication_role = default;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is not null then
    perform record_changelog(
      pid,
      v_editor,
      'projects',
      pid,
      'layers:z-order-change'::change_log_field_group,
      '{}'::jsonb,
      jsonb_build_object('reordered_count', v_reordered_count),
      null,
      null,
      null
    );
  end if;

  return query (select * from data_layers where id = any("dataLayerIds"));
end;
$$;

comment on function public.update_z_indexes("dataLayerIds" integer[]) is
  'Batch reassigns z_index for one project. Records change_logs (layers:z-order-change) on projects when session.user_id is set; to_summary includes reordered_count.';

update change_logs
set
  from_summary = '{}'::jsonb,
  to_summary = jsonb_build_object('reordered_count', null)
where field_group = 'layers:z-order-change'
  and from_summary = '{}'::jsonb
  and to_summary = '{}'::jsonb
  and from_blob is null
  and to_blob is null;
