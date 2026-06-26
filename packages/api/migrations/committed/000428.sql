--! Previous: sha1:49e04bba78e22aaa1493a92ca3f465b92780ba9f
--! Hash: sha1:09532ee08a6abd672c0fbed235e5b2c3d6e8fdcf

-- Make the generated-column helper safe for RDS/pg_upgrade binary restore.
--
-- RDS temporarily restores tables into a generated schema during major-version
-- upgrades. SQL functions used by stored generated columns may be inlined while
-- those objects are still in that temporary schema, so the helper must not rely
-- on unqualified enum casts or calls to other application functions.
create or replace function public.changelog_row_net_zero_changes(
  p_field_group public.change_log_field_group,
  p_from_summary jsonb,
  p_to_summary jsonb,
  p_from_blob jsonb,
  p_to_blob jsonb
) returns boolean
language sql
immutable
parallel safe
as $$
  with normalized_attribution as (
    select
      case
        when p_from_summary is null then '{"attribution": null}'::jsonb
        when p_from_summary = '{}'::jsonb then '{"attribution": null}'::jsonb
        when not (p_from_summary ? 'attribution') then '{"attribution": null}'::jsonb
        when jsonb_typeof(p_from_summary->'attribution') = 'null' then '{"attribution": null}'::jsonb
        when trim(coalesce(p_from_summary->>'attribution', '')) = '' then '{"attribution": null}'::jsonb
        else jsonb_build_object('attribution', btrim(p_from_summary->>'attribution'))
      end as from_summary,
      case
        when p_to_summary is null then '{"attribution": null}'::jsonb
        when p_to_summary = '{}'::jsonb then '{"attribution": null}'::jsonb
        when not (p_to_summary ? 'attribution') then '{"attribution": null}'::jsonb
        when jsonb_typeof(p_to_summary->'attribution') = 'null' then '{"attribution": null}'::jsonb
        when trim(coalesce(p_to_summary->>'attribution', '')) = '' then '{"attribution": null}'::jsonb
        else jsonb_build_object('attribution', btrim(p_to_summary->>'attribution'))
      end as to_summary
  )
  select case
    when p_field_group::text in (
      'resolvable_layer_comments:created',
      'resolvable_layer_comments:responded',
      'resolvable_layer_comments:resolved',
      'resolvable_layer_comments:reopened'
    ) then false
    when (p_from_blob is not null) or (p_to_blob is not null) then
      not (p_from_blob is distinct from p_to_blob)
    when p_field_group::text = 'layer:attribution' then
      not (
        normalized_attribution.from_summary
        is distinct from
        normalized_attribution.to_summary
      )
    else
      not (p_from_summary is distinct from p_to_summary)
  end
  from normalized_attribution;
$$;

comment on function public.changelog_row_net_zero_changes(
  public.change_log_field_group,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) is
  'Stored generated expression for change_logs.net_zero_changes. Kept self-contained so RDS binary upgrades can inline it while restoring temporary schemas.';

-- The GeographyPlugin owns geography creation/update/deletion mutations. After
-- the Postgres major upgrade, PostGraphile started exposing generated CRUD input
-- types for project_geography, which collides with the plugin-defined
-- CreateProjectGeographyInput and prevents the custom Geography type extensions
-- from resolving. Make the intended GraphQL contract explicit.
comment on table public.project_geography is E'@name Geography
@simpleCollections only
@omit create,update,delete';
