-- Survey spatial questions own a generated sketch class (form_element_id set,
-- name generated-form-element-<id>). Those classes are not user sketch classes.
-- Reports must not be assigned to them.

create or replace function public.create_custom_report(
  project_id integer,
  title text,
  sketch_class_ids integer[] default null
) returns public.reports
language plpgsql
security definer
as $$
declare
  new_report public.reports;
  dr_report_tab_id int;
  class_ids integer[];
  invalid_count int;
  owning_sketch_class_id integer;
begin
  if not session_is_admin(project_id) then
    raise exception 'You are not authorized to create reports for this project';
  end if;

  if nullif(title, '') is null then
    raise exception 'Title is required';
  end if;

  class_ids := coalesce(sketch_class_ids, '{}');

  if array_length(class_ids, 1) > 0 then
    select count(*)
    into invalid_count
    from unnest(class_ids) class_id
    left join public.sketch_classes sc
      on sc.id = class_id
     and sc.project_id = create_custom_report.project_id
    where sc.id is null;

    if invalid_count > 0 then
      raise exception 'All sketch classes must belong to the same project';
    end if;

    select count(*)
    into invalid_count
    from unnest(class_ids) class_id
    join public.sketch_classes sc
      on sc.id = class_id
    where sc.form_element_id is not null;

    if invalid_count > 0 then
      raise exception 'Reports cannot be assigned to sketch classes that belong to a survey question';
    end if;
  end if;

  -- Legacy reports.sketch_class_id NOT NULL: use first selected class when provided.
  -- Project-only drafts (no selection) rely on sketch_class_id being nullable (see redo DDL above).
  owning_sketch_class_id :=
    case
      when array_length(class_ids, 1) > 0 then class_ids[1]
      else null
    end;

  insert into public.reports (
    project_id,
    sketch_class_id,
    title,
    version,
    draft_id,
    published_at
  ) values (
    project_id,
    owning_sketch_class_id,
    title,
    0,
    null,
    null
  ) returning * into new_report;

  insert into public.report_tabs (
    report_id,
    title,
    position
  ) values (
    new_report.id,
    'Attributes',
    0
  ) returning id into dr_report_tab_id;

  if array_length(class_ids, 1) > 0 then
    -- Clear existing relations for provided classes before assigning this report as primary.
    delete from public.sketch_class_reports scr
    where scr.sketch_class_id = any(class_ids);

    insert into public.sketch_class_reports (
      sketch_class_id,
      draft_report_id,
      is_primary
    )
    select
      class_id,
      new_report.id,
      true
    from unnest(class_ids) class_id;
  end if;

  return new_report;
end;
$$;

create or replace function public.set_primary_report_for_sketch_class(
  sketch_class_id integer,
  draft_report_id integer
) returns public.sketch_classes
language plpgsql
security definer
as $$
declare
  project_id int;
  report_project_id int;
  report_version int;
  survey_form_element_id int;
  selected public.sketch_classes;
begin
  select sc.project_id, sc.form_element_id
  into project_id, survey_form_element_id
  from public.sketch_classes sc
  where sc.id = set_primary_report_for_sketch_class.sketch_class_id;

  if project_id is null then
    raise exception 'Sketch class not found';
  end if;

  if not session_is_admin(project_id) then
    raise exception 'You are not authorized to change report assignments for this sketch class';
  end if;

  if survey_form_element_id is not null then
    raise exception 'Reports cannot be assigned to sketch classes that belong to a survey question';
  end if;

  select r.project_id, r.version
  into report_project_id, report_version
  from public.reports r
  where r.id = set_primary_report_for_sketch_class.draft_report_id;

  if report_project_id is null then
    raise exception 'Report not found';
  end if;

  if report_project_id != project_id then
    raise exception 'Report must belong to the same project as the sketch class';
  end if;

  if report_version != 0 then
    raise exception 'Assertion failed: Only draft reports can be assigned to a sketch class.';
  end if;

  -- clear any existing primary assignment (qualify columns — params share names with columns)
  delete from public.sketch_class_reports scr
  where scr.sketch_class_id = set_primary_report_for_sketch_class.sketch_class_id
    and scr.is_primary = true;

  insert into public.sketch_class_reports (
    sketch_class_id,
    draft_report_id,
    is_primary
  ) values (
    set_primary_report_for_sketch_class.sketch_class_id,
    set_primary_report_for_sketch_class.draft_report_id,
    true
  );

  select *
  into selected
  from public.sketch_classes sc
  where sc.id = set_primary_report_for_sketch_class.sketch_class_id;
  return selected;
end;
$$;
