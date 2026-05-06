-- undo

drop function if exists public.get_latest_published_report_for_draft(integer);
drop function if exists public.get_primary_draft_report_id_for_sketch_class(integer);
drop function if exists public.get_effective_report_for_sketch_class(integer, boolean);
drop function if exists public.create_report(integer, text, integer[]);
drop function if exists public.create_custom_report(integer, text, integer[]);
drop function if exists public.create_project_draft_report(integer, text);
drop function if exists public.set_primary_report_for_sketch_class(integer, integer);
drop function if exists public.sketch_classes_draft_report(public.sketch_classes);
drop function if exists public.sketch_classes_report(public.sketch_classes);
drop function if exists public.publish_report(integer);
drop function if exists public.create_draft_report(integer);

drop table if exists public.sketch_class_reports cascade;

drop index if exists public.reports_draft_id_version_unique;
drop index if exists public.reports_draft_id_idx;
alter table if exists public.reports
  drop constraint if exists reports_draft_id_version_check;
alter table if exists public.reports
  drop column if exists published_at;
alter table if exists public.reports
  drop column if exists draft_id;
alter table if exists public.reports
  drop column if exists version;
alter table if exists public.reports
  drop column if exists title;

-- redo

alter table public.reports
  add column if not exists title text;

alter table public.reports
  add column if not exists version integer not null default 0;

alter table public.reports
  add column if not exists draft_id integer references public.reports(id) on delete cascade;

alter table public.reports
  add column if not exists published_at timestamp with time zone;

alter table public.reports
  add constraint reports_draft_id_version_check
  check (
    (draft_id is null and version = 0) or
    (draft_id is not null and version > 0)
  );

create index if not exists reports_draft_id_idx on public.reports (draft_id);
create unique index if not exists reports_draft_id_version_unique
  on public.reports (draft_id, version)
  where draft_id is not null;

create table if not exists public.sketch_class_reports (
  sketch_class_id integer not null references public.sketch_classes(id) on delete cascade,
  draft_report_id integer not null references public.reports(id) on delete cascade,
  is_primary boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (sketch_class_id, draft_report_id)
);

create unique index if not exists sketch_class_reports_one_primary_per_class
  on public.sketch_class_reports (sketch_class_id)
  where is_primary = true;

create index if not exists sketch_class_reports_draft_report_id_idx
  on public.sketch_class_reports (draft_report_id);

-- Basic backfill for legacy reports.
update public.reports r
set title = coalesce(
    (
      select concat(sc.name, ' Report')
      from public.sketch_classes sc
      where sc.draft_report_id = r.id
         or sc.report_id = r.id
      order by
        case when sc.draft_report_id = r.id then 0 else 1 end,
        sc.id asc
      limit 1
    ),
    (
      select rt.title
      from public.report_tabs rt
      where rt.report_id = r.id
      order by rt.position asc
      limit 1
    ),
    'Report ' || r.id::text
  )
where r.title is null;

alter table public.reports
  alter column title set not null;

-- Ensure reports referenced as sketch-class drafts are marked as lineage roots.
update public.reports r
set
  version = 0,
  draft_id = null,
  published_at = null
where r.id in (
  select distinct sc.draft_report_id
  from public.sketch_classes sc
  where sc.draft_report_id is not null
);

-- Mark published reports as versioned snapshots in the draft lineage when possible.
update public.reports r
set
  draft_id = coalesce(sc.draft_report_id, sc.report_id),
  version = case
    when coalesce(sc.draft_report_id, sc.report_id) = sc.report_id then 0
    else greatest(r.version, 1)
  end,
  published_at = case
    when coalesce(sc.draft_report_id, sc.report_id) = sc.report_id then null
    else coalesce(r.published_at, r.created_at)
  end
from public.sketch_classes sc
where sc.report_id is not null
  and sc.report_id = r.id;

-- Seed primary assignments (legacy draft preferred; fallback to report id).
insert into public.sketch_class_reports (sketch_class_id, draft_report_id, is_primary)
select
  sc.id as sketch_class_id,
  coalesce(sc.draft_report_id, sc.report_id) as draft_report_id,
  true as is_primary
from public.sketch_classes sc
where coalesce(sc.draft_report_id, sc.report_id) is not null
on conflict (sketch_class_id, draft_report_id) do update
set
  is_primary = excluded.is_primary,
  updated_at = now();

-- Remove legacy reports that are not part of any assigned lineage.
with assigned_lineages as (
  select distinct scr.draft_report_id
  from public.sketch_class_reports scr
)
delete from public.reports r
where not exists (
  select 1
  from assigned_lineages al
  where al.draft_report_id = r.id
)
and not exists (
  select 1
  from assigned_lineages al
  where al.draft_report_id = r.draft_id
);

create or replace function public.get_primary_draft_report_id_for_sketch_class(
  sketch_class_id integer
) returns integer
language sql
stable
security definer
as $$
  select scr.draft_report_id
  from public.sketch_class_reports scr
  where scr.sketch_class_id = get_primary_draft_report_id_for_sketch_class.sketch_class_id
    and scr.is_primary = true
  order by scr.updated_at desc, scr.created_at desc
  limit 1;
$$;

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
  end if;

  insert into public.reports (
    project_id,
    title,
    version,
    draft_id,
    published_at
  ) values (
    project_id,
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

  insert into public.report_cards (
    report_tab_id,
    body,
    position,
    alternate_language_settings,
    component_settings
  ) values (
    dr_report_tab_id,
    '{"type": "doc", "content": [{"type": "reportTitle", "content": [{"type": "text", "text": "Attributes"}]}]}'::jsonb,
    0,
    '{}',
    jsonb_build_object('type', 'Attributes')
  );

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
  selected public.sketch_classes;
begin
  select sc.project_id
  into project_id
  from public.sketch_classes sc
  where sc.id = sketch_class_id;

  if project_id is null then
    raise exception 'Sketch class not found';
  end if;

  if not session_is_admin(project_id) then
    raise exception 'You are not authorized to change report assignments for this sketch class';
  end if;

  select r.project_id, r.version
  into report_project_id, report_version
  from public.reports r
  where r.id = draft_report_id;

  if report_project_id is null then
    raise exception 'Report not found';
  end if;

  if report_project_id != project_id then
    raise exception 'Report must belong to the same project as the sketch class';
  end if;

  if report_version != 0 then
    raise exception 'Assertion failed: Only draft reports can be assigned to a sketch class.';
  end if;

  -- clear any existing primary assignment
  delete from public.sketch_class_reports
  where sketch_class_id = set_primary_report_for_sketch_class.sketch_class_id
    and is_primary = true;

  insert into public.sketch_class_reports (
    sketch_class_id,
    draft_report_id,
    is_primary
  ) values (
    sketch_class_id,
    draft_report_id,
    true
  );

  select *
  into selected
  from public.sketch_classes
  where id = sketch_class_id;
  return selected;
end;
$$;

create or replace function public.get_latest_published_report_for_draft(
  draft_report_id integer
) returns integer
language sql
stable
security definer
as $$
  select r.id
  from public.reports r
  where r.draft_id = get_latest_published_report_for_draft.draft_report_id
    and r.version > 0
  order by r.version desc, r.created_at desc
  limit 1;
$$;

create or replace function public.sketch_classes_draft_report(
  sc public.sketch_classes
) returns public.reports
language sql
stable
as $$
  select *
  from public.reports r
  where r.id = public.get_primary_draft_report_id_for_sketch_class(sc.id)
  limit 1;
$$;

create or replace function public.sketch_classes_report(
  sc public.sketch_classes
) returns public.reports
language sql
stable
as $$
  select *
  from public.reports r
  where r.id = public.get_latest_published_report_for_draft(
    public.get_primary_draft_report_id_for_sketch_class(sc.id)
  )
  limit 1;
$$;

create or replace function public.publish_report(report_id integer)
returns public.sketch_classes
language plpgsql
security definer
as $$
declare
  published_sketch_class public.sketch_classes;
  new_report public.reports;
  draft_report_id int;
  project_id int;
  draft_report_version int;
  draft_lineage_parent_id int;
  draft_sketch_class_id int;
  new_report_id int;
  old_tab_id int;
  new_tab_id int;
  referenced_stable_ids text[];
  missing_outputs integer[];
  stable_ids_missing_outputs text[];
  draft_data_source_urls text[];
  published_data_source_urls text[];
  sid text;
  max_lineage_version int;
begin
  draft_report_id := report_id;

  select
    r.project_id,
    r.version,
    r.draft_id,
    r.sketch_class_id
  into
    project_id,
    draft_report_version,
    draft_lineage_parent_id,
    draft_sketch_class_id
  from public.reports r
  where r.id = draft_report_id;

  if project_id is null then
    raise exception 'Report not found';
  end if;

  if not session_is_admin(project_id) then
    raise exception 'You are not authorized to publish this report';
  end if;

  if draft_report_version != 0 or draft_lineage_parent_id is not null then
    raise exception 'Only draft reports can be published';
  end if;

  select coalesce(max(version), 0)
  into max_lineage_version
  from public.reports r
  where r.id = draft_report_id or r.draft_id = draft_report_id;

  referenced_stable_ids := public.get_referenced_stable_ids_for_report(draft_report_id);
  if array_length(referenced_stable_ids, 1) > 0 then
    if (
      select count(*) from public.table_of_contents_items
      where stable_id = any(referenced_stable_ids) and is_draft = false
    ) < array_length(referenced_stable_ids, 1) then
      raise exception 'This report references data layers that have not yet been published. Please publish the layer list first.';
    end if;

    draft_data_source_urls := (
      select array_agg(url)
      from public.data_sources
      where id = any(
        select data_source_id
        from public.data_layers
        where id = any(
          select data_layer_id
          from public.table_of_contents_items
          where stable_id = any(referenced_stable_ids)
            and is_draft = true
        )
      )
    );

    published_data_source_urls := (
      select array_agg(url)
      from public.data_sources
      where url = any(draft_data_source_urls)
        and id = any(
          select data_source_id
          from public.data_layers
          where id = any(
            select data_layer_id
            from public.table_of_contents_items
            where stable_id = any(referenced_stable_ids)
              and is_draft = false
          )
        )
    );

    if array_length(draft_data_source_urls, 1) != array_length(published_data_source_urls, 1) then
      raise exception 'This report references updated versions of data sources which have not yet been published. Please publish the data sources first.';
    end if;

    missing_outputs := public.verify_table_of_contents_items_have_report_outputs(
      (
        select array_agg(id)
        from public.table_of_contents_items
        where stable_id = any(referenced_stable_ids) and is_draft = true
      )
    );
    if array_length(missing_outputs, 1) > 0 then
      raise exception 'This report references table of contents items that have not yet been processed for reporting. Please review your report for errors and ensure all cards render correctly before publishing.';
    end if;

    stable_ids_missing_outputs := (
      select array_agg(stable_id)
      from public.table_of_contents_items
      where stable_id = any(referenced_stable_ids)
        and is_draft = false
        and public.table_of_contents_items_reporting_output(public.table_of_contents_items.*) is null
    );

    if array_length(stable_ids_missing_outputs, 1) > 0 then
      foreach sid in array stable_ids_missing_outputs loop
        insert into public.data_upload_outputs (
          data_source_id,
          project_id,
          type,
          url,
          remote,
          is_original,
          size,
          filename,
          original_filename,
          is_custom_upload,
          fgb_header_size,
          source_processing_job_key,
          epsg,
          num_features,
          num_invalid_features,
          num_repaired_features,
          was_repaired,
          contains_overlapping_features
        ) select
          (
            select data_source_id
            from public.data_layers
            where id = (
              select data_layer_id
              from public.table_of_contents_items
              where stable_id = sid and is_draft = false
            )
          ),
          d.project_id,
          d.type,
          d.url,
          d.remote,
          d.is_original,
          d.size,
          d.filename,
          d.original_filename,
          d.is_custom_upload,
          d.fgb_header_size,
          d.source_processing_job_key,
          d.epsg,
          d.num_features,
          d.num_invalid_features,
          d.num_repaired_features,
          d.was_repaired,
          d.contains_overlapping_features
        from public.data_upload_outputs d
        where d.data_source_id = (
            select data_source_id
            from public.data_layers
            where id = (
              select data_layer_id
              from public.table_of_contents_items
              where stable_id = sid and is_draft = true
            )
          )
          and public.is_reporting_type(d.type)
        order by d.created_at desc
        limit 1;
      end loop;
    end if;
  end if;

  insert into public.reports (
    project_id,
    sketch_class_id,
    title,
    version,
    draft_id,
    published_at
  )
  select
    r.project_id,
    coalesce(r.sketch_class_id, draft_sketch_class_id),
    coalesce(r.title, 'Untitled Report'),
    max_lineage_version + 1,
    draft_report_id,
    now()
  from public.reports r
  where r.id = draft_report_id
  returning * into new_report;

  new_report_id := new_report.id;

  -- Copy report tabs + cards preserving positions and language settings.
  for old_tab_id in
    select rt.id
    from public.report_tabs rt
    where rt.report_id = draft_report_id
    order by rt.position
  loop
    insert into public.report_tabs (
      report_id,
      title,
      position,
      alternate_language_settings,
      updated_at
    )
    select
      new_report_id,
      rt.title,
      rt.position,
      rt.alternate_language_settings,
      rt.updated_at
    from public.report_tabs rt
    where rt.id = old_tab_id
    returning id into new_tab_id;

    insert into public.report_cards (
      report_tab_id,
      body,
      position,
      alternate_language_settings,
      component_settings,
      updated_at,
      is_draft
    )
    select
      new_tab_id,
      rc.body,
      rc.position,
      rc.alternate_language_settings,
      rc.component_settings,
      rc.updated_at,
      false
    from public.report_cards rc
    where rc.report_tab_id = old_tab_id
    order by rc.position;
  end loop;

  select * into published_sketch_class
  from public.sketch_classes
  where id = draft_sketch_class_id;
  return published_sketch_class;
end;
$$;

grant all on function public.create_custom_report(integer, text, integer[]) to seasketch_user;
grant all on function public.publish_report(integer) to seasketch_user;
grant all on function public.set_primary_report_for_sketch_class(integer, integer) to seasketch_user;
grant all on function public.get_primary_draft_report_id_for_sketch_class(integer) to seasketch_user;
grant all on function public.get_latest_published_report_for_draft(integer) to seasketch_user;
grant all on function public.sketch_classes_draft_report(public.sketch_classes) to anon;
grant all on function public.sketch_classes_draft_report(public.sketch_classes) to seasketch_user;
grant all on function public.sketch_classes_report(public.sketch_classes) to anon;
grant all on function public.sketch_classes_report(public.sketch_classes) to seasketch_user;
grant all on function public.get_primary_draft_report_id_for_sketch_class(integer) to seasketch_superuser;
grant all on function public.get_latest_published_report_for_draft(integer) to seasketch_superuser;
grant all on function public.create_custom_report(integer, text, integer[]) to seasketch_superuser;
grant all on function public.publish_report(integer) to seasketch_superuser;
grant all on function public.sketch_classes_draft_report(public.sketch_classes) to seasketch_superuser;
grant all on function public.sketch_classes_report(public.sketch_classes) to seasketch_superuser;
