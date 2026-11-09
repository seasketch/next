--! Message: duplicate report

-- undo

drop function if exists public.duplicate_report(integer);

drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports
  for all
  using (
    public.session_is_admin((
      select sketch_classes.project_id
      from public.sketch_classes
      where sketch_classes.id = reports.sketch_class_id
    ))
  )
  with check (
    public.session_is_admin((
      select sketch_classes.project_id
      from public.sketch_classes
      where sketch_classes.id = reports.sketch_class_id
    ))
  );

-- redo

-- Project-scoped drafts (sketch_class_id is null) must still be editable by
-- project admins. The previous policy only matched a sketch class row, so
-- unassigned reports could not be renamed or deleted.
drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports
  for all
  using (public.session_is_admin(project_id))
  with check (public.session_is_admin(project_id));

-- Copies a draft report's tabs and cards into a new unassigned draft.
-- create_custom_report cannot do this: it always inserts a blank Attributes
-- tab and, when given sketch classes, replaces their primary assignment.
create or replace function public.duplicate_report(source_report_id integer)
returns public.reports
language plpgsql
security definer
as $$
declare
  source public.reports;
  new_report public.reports;
  new_title text;
  suffix text;
  n int;
  old_tab record;
  new_tab_id int;
begin
  select *
  into source
  from public.reports r
  where r.id = source_report_id;

  if source.id is null then
    raise exception 'Report not found';
  end if;

  if not public.session_is_admin(source.project_id) then
    raise exception 'You are not authorized to duplicate this report';
  end if;

  if source.version <> 0 or source.draft_id is not null then
    raise exception 'Only draft reports can be duplicated';
  end if;

  -- "Title (copy)", then "Title (copy 2)", and so on.
  n := 1;
  loop
    if n = 1 then
      suffix := ' (copy)';
    else
      suffix := ' (copy ' || n::text || ')';
    end if;
    new_title := source.title || suffix;
    exit when not exists (
      select 1
      from public.reports r
      where r.project_id = source.project_id
        and r.title = new_title
    );
    n := n + 1;
    if n > 1000 then
      raise exception 'Could not generate a unique title for the duplicated report';
    end if;
  end loop;

  -- Leave sketch_class_id null and do not insert sketch_class_reports.
  -- The copy is an exploration draft until an admin assigns it.
  insert into public.reports (
    project_id,
    sketch_class_id,
    title,
    version,
    draft_id,
    published_at
  ) values (
    source.project_id,
    null,
    new_title,
    0,
    null,
    null
  ) returning * into new_report;

  for old_tab in
    select
      rt.id,
      rt.title,
      rt.position,
      rt.alternate_language_settings
    from public.report_tabs rt
    where rt.report_id = source.id
    order by rt.position, rt.id
  loop
    insert into public.report_tabs (
      report_id,
      title,
      position,
      alternate_language_settings
    ) values (
      new_report.id,
      old_tab.title,
      old_tab.position,
      old_tab.alternate_language_settings
    ) returning id into new_tab_id;

    insert into public.report_cards (
      report_tab_id,
      body,
      position,
      alternate_language_settings,
      component_settings,
      is_draft
    )
    select
      new_tab_id,
      rc.body,
      rc.position,
      rc.alternate_language_settings,
      rc.component_settings,
      rc.is_draft
    from public.report_cards rc
    where rc.report_tab_id = old_tab.id
    order by rc.position, rc.id;
  end loop;

  return new_report;
end;
$$;

comment on function public.duplicate_report(integer) is
  'Copies a draft report, including its tabs and cards, into a new unassigned draft titled "<title> (copy)".';

grant all on function public.duplicate_report(integer) to seasketch_user;
grant all on function public.duplicate_report(integer) to seasketch_superuser;
