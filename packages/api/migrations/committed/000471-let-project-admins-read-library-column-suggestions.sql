--! Previous: sha1:a4205800dd2d5ce0320b1146c54cc40b1e287ef7
--! Hash: sha1:9681f248f7599ce304dfcc416048513eb5f86d80
--! Message: Let project admins read library column suggestions

-- A data-library source belongs to the template project. The upload worker
-- stores suggested columns on that project. Reporting layers join those
-- notes, and a partner admin could not see them.

drop policy ai_data_analyst_notes_select on public.ai_data_analyst_notes;

create policy ai_data_analyst_notes_select
  on public.ai_data_analyst_notes
  for select
  using (
    session_is_admin(project_id)
    or session_admin_uses_data_source(data_source_id)
  );
