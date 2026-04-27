--! Previous: sha1:00b013be5df3d75815b4265eda681bd8171ce6a2
--! Hash: sha1:5295be379ba4c07364271f3aa1d66e92d85eef6d

drop function if exists changelog_summary_attribution(text);

-- Normalization for comparing stored layer:attribution summaries only (computed; does not mutate rows).
create or replace function changelog_normalize_layer_attribution_summary(p jsonb)
  returns jsonb
  language sql
  immutable
  parallel safe
as $$
  select case
    when p is null then '{"attribution": null}'::jsonb
    when p = '{}'::jsonb then '{"attribution": null}'::jsonb
    when not (p ? 'attribution') then '{"attribution": null}'::jsonb
    when jsonb_typeof(p->'attribution') = 'null' then '{"attribution": null}'::jsonb
    when trim(coalesce(p->>'attribution', '')) = '' then '{"attribution": null}'::jsonb
    else jsonb_build_object('attribution', btrim(p->>'attribution'))
  end;
$$;

comment on function changelog_normalize_layer_attribution_summary(jsonb) is
  'Projection of layer:attribution changelog summaries for equivalence (empty object, omitted key, "", JSON null treated as no attribution). Used only by net_zero_changes.';

create or replace function changelog_row_net_zero_changes(
  p_field_group change_log_field_group,
  p_from_summary jsonb,
  p_to_summary jsonb,
  p_from_blob jsonb,
  p_to_blob jsonb
)
  returns boolean
  language sql
  immutable
  parallel safe
as $$
  select case
    when (p_from_blob is not null) or (p_to_blob is not null) then
      not (p_from_blob is distinct from p_to_blob)
    when p_field_group = 'layer:attribution'::change_log_field_group then
      not (
        changelog_normalize_layer_attribution_summary(p_from_summary)
        is distinct from
        changelog_normalize_layer_attribution_summary(p_to_summary)
      )
    else
      not (p_from_summary is distinct from p_to_summary)
  end;
$$;

comment on function changelog_row_net_zero_changes(change_log_field_group, jsonb, jsonb, jsonb, jsonb) is
  'Stored generated expression for change_logs.net_zero_changes (blob compare; layer:attribution normalized summary compare; else raw summaries).';

drop index if exists change_logs_project_type_lastat_idx;
drop index if exists change_logs_project_entity_lastat_idx;
drop index if exists change_logs_project_lastat_idx;

alter table change_logs drop column net_zero_changes;

alter table change_logs
  add column net_zero_changes boolean
  generated always as (
    changelog_row_net_zero_changes(
      field_group,
      from_summary,
      to_summary,
      from_blob,
      to_blob
    )
  ) stored;

create index if not exists change_logs_project_type_lastat_idx
  on change_logs (project_id, entity_type, net_zero_changes, last_at desc);

create index if not exists change_logs_project_entity_lastat_idx
  on change_logs (project_id, entity_type, entity_id, net_zero_changes, last_at desc);

create index if not exists change_logs_project_lastat_idx
  on change_logs (project_id, net_zero_changes, last_at desc);
