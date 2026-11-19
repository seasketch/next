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
