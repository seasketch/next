--! Previous: sha1:40c742db85791cb69737d414b5e0341789e29d3b
--! Hash: sha1:49e04bba78e22aaa1493a92ca3f465b92780ba9f

-- Enter migration here
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
        changelog_normalize_layer_attribution_summary(p_from_summary)
        is distinct from
        changelog_normalize_layer_attribution_summary(p_to_summary)
      )
    else
      not (p_from_summary is distinct from p_to_summary)
  end;
$$;
