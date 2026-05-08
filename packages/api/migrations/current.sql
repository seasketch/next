-- undo

drop function if exists public.nest_new_project_geography_draft_toc_under_folder(integer);

drop trigger if exists trg_prevent_delete_data_layer_geography_clipping on public.data_layers;
drop function if exists public.prevent_delete_data_layer_if_referenced_by_geography_clipping();

drop function if exists public.set_project_region_bounds(integer, double precision, double precision, double precision, double precision);

-- Restore NOT NULL on sketch_class_id (best-effort backfill for project-scoped drafts).
update public.reports r
set sketch_class_id = (
  select min(sc.id)
  from public.sketch_classes sc
  where sc.project_id = r.project_id
)
where r.sketch_class_id is null;

delete from public.reports where sketch_class_id is null;

alter table if exists public.reports
  alter column sketch_class_id set not null;

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
drop function if exists public.publish_report_snapshot(integer);
drop function if exists public.create_draft_report(integer);
drop function if exists public.create_default_report(integer);

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

-- Project-scoped drafts from create_custom_report have no legacy owning sketch_class row.
alter table public.reports
  alter column sketch_class_id drop not null;

alter type public.spatial_metric_type add value if not exists 'raster_stats';

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

-- Deleting a draft report row removes sketch_class_reports assignments automatically because
-- sketch_class_reports.draft_report_id references reports(id) ON DELETE CASCADE.
-- Legacy sketch_classes.draft_report_id / sketch_classes.report_id FKs (committed migrations)
-- use ON DELETE SET NULL so sketch classes are not left pointing at deleted reports.
-- Published snapshots in the same lineage reference the draft via reports.draft_id with ON DELETE CASCADE.

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
  candidate.draft_report_id,
  true as is_primary
from public.sketch_classes sc
join lateral (
  select coalesce(sc.draft_report_id, sc.report_id) as draft_report_id
) candidate on true
join public.reports r on r.id = candidate.draft_report_id
where candidate.draft_report_id is not null
  and r.project_id = sc.project_id
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
  selected public.sketch_classes;
begin
  select sc.project_id
  into project_id
  from public.sketch_classes sc
  where sc.id = set_primary_report_for_sketch_class.sketch_class_id;

  if project_id is null then
    raise exception 'Sketch class not found';
  end if;

  if not session_is_admin(project_id) then
    raise exception 'You are not authorized to change report assignments for this sketch class';
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

-- Trusted snapshot publish (no session check). Used by backend jobs and create_default_report.
create or replace function public.publish_report_snapshot(p_draft_report_id integer)
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
  draft_report_id := p_draft_report_id;

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

create or replace function public.publish_report(report_id integer)
returns public.sketch_classes
language plpgsql
security definer
as $$
declare
  draft_report_id int;
  project_id int;
begin
  draft_report_id := report_id;

  select r.project_id
  into project_id
  from public.reports r
  where r.id = draft_report_id;

  if project_id is null then
    raise exception 'Report not found';
  end if;

  if not session_is_admin(project_id) then
    raise exception 'You are not authorized to publish this report';
  end if;

  return public.publish_report_snapshot(draft_report_id);
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

-- undo

alter table public.projects add column if not exists enable_report_builder boolean default false;
alter table public.projects add column if not exists enable_collection_new_reports boolean default false;

comment on column public.projects.enable_collection_new_reports is 'When true, administrators may configure collection sketch classes to use the new reporting tools in project admin.';

grant update(enable_report_builder) on table public.projects to seasketch_user;
grant update(enable_collection_new_reports) on table public.projects to seasketch_user;

create or replace function public.get_sketch_class_fragment_status(p_project_id integer)
returns table(sketch_class_id integer, sketch_class_name text, missing_count integer)
language plpgsql
stable
security definer
as $$
begin
  if not session_is_admin(p_project_id) then
    return;
  end if;

  if not exists (
    select 1
    from projects
    where id = p_project_id
      and enable_report_builder = true
  ) then
    return;
  end if;

  return query
  select
    sc.id as sketch_class_id,
    sc.name::text as sketch_class_name,
    count(s.id)::int as missing_count
  from sketch_classes sc
  join sketches s on s.sketch_class_id = sc.id
  where sc.project_id = p_project_id
    and sc.geometry_type = 'POLYGON'
    and (
      sc.is_geography_clipping_enabled = true
      or coalesce(sc.preview_new_reports, false) = true
    )
    and not exists (
      select 1
      from sketch_fragments sf
      where sf.sketch_id = s.id
    )
  group by sc.id, sc.name
  order by count(s.id) desc, sc.name asc;
end;
$$;

create or replace function public.projects_sketches_missing_fragments(project public.projects)
returns integer
language plpgsql
stable
security definer
as $$
declare
  num_missing_fragments integer;
begin
  if session_is_admin(project.id) then
    if project.enable_report_builder then
      with sketch_class_ids as (
        select id
        from sketch_classes
        where project_id = project.id
          and geometry_type = 'POLYGON'
          and (
            is_geography_clipping_enabled = true
            or preview_new_reports = true
          )
      )
      select count(*) into num_missing_fragments
      from sketches
      where sketch_class_id = any (select id from sketch_class_ids)
        and not exists (
          select 1 from sketch_fragments where sketch_fragments.sketch_id = sketches.id
        );
      return num_missing_fragments;
    else
      return 0;
    end if;
  else
    raise exception 'Must be a project admin to view missing fragments';
  end if;
end;
$$;

create or replace function public.sketch_classes_use_geography_clipping(sketch_class public.sketch_classes)
returns boolean
language sql
stable
security definer
as $$
  select sketch_class.is_geography_clipping_enabled and (
    select enable_report_builder from projects where id = sketch_class.project_id
  ) and (
    select count(*) > 0 from sketch_class_geographies where sketch_class_id = sketch_class.id
  );
$$;

-- redo

alter table public.projects drop column if exists enable_report_builder;
alter table public.projects drop column if exists enable_collection_new_reports;

create or replace function public.get_sketch_class_fragment_status(p_project_id integer)
returns table(sketch_class_id integer, sketch_class_name text, missing_count integer)
language plpgsql
stable
security definer
as $$
begin
  if not session_is_admin(p_project_id) then
    return;
  end if;

  return query
  select
    sc.id as sketch_class_id,
    sc.name::text as sketch_class_name,
    count(s.id)::int as missing_count
  from sketch_classes sc
  join sketches s on s.sketch_class_id = sc.id
  where sc.project_id = p_project_id
    and sc.geometry_type = 'POLYGON'
    and (
      sc.is_geography_clipping_enabled = true
      or coalesce(sc.preview_new_reports, false) = true
    )
    and not exists (
      select 1
      from sketch_fragments sf
      where sf.sketch_id = s.id
    )
  group by sc.id, sc.name
  order by count(s.id) desc, sc.name asc;
end;
$$;

create or replace function public.projects_sketches_missing_fragments(project public.projects)
returns integer
language plpgsql
stable
security definer
as $$
declare
  num_missing_fragments integer;
begin
  if session_is_admin(project.id) then
    with sketch_class_ids as (
      select id
      from sketch_classes
      where project_id = project.id
        and geometry_type = 'POLYGON'
        and (
          is_geography_clipping_enabled = true
          or preview_new_reports = true
        )
    )
    select count(*) into num_missing_fragments
    from sketches
    where sketch_class_id = any (select id from sketch_class_ids)
      and not exists (
        select 1 from sketch_fragments where sketch_fragments.sketch_id = sketches.id
      );
    return num_missing_fragments;
  else
    raise exception 'Must be a project admin to view missing fragments';
  end if;
end;
$$;

create or replace function public.sketch_classes_use_geography_clipping(sketch_class public.sketch_classes)
returns boolean
language sql
stable
security definer
as $$
  select sketch_class.is_geography_clipping_enabled and (
    select count(*) > 0 from sketch_class_geographies where sketch_class_id = sketch_class.id
  );
$$;

create or replace function public.create_default_report(p_project_id integer)
returns public.reports
language plpgsql
security definer
as $$
declare
  new_report public.reports;
  tab_id integer;
begin
  if exists (
    select 1
    from public.reports r
    where r.project_id = p_project_id
  ) then
    return null;
  end if;

  insert into public.reports (
    project_id,
    sketch_class_id,
    title,
    version,
    draft_id,
    published_at
  ) values (
    p_project_id,
    null,
    'Default report',
    0,
    null,
    null
  )
  returning * into new_report;

  insert into public.report_tabs (
    report_id,
    title,
    position
  ) values (
    new_report.id,
    'Attributes',
    0
  )
  returning id into tab_id;

  insert into public.report_cards (
    report_tab_id,
    body,
    position,
    alternate_language_settings,
    component_settings,
    updated_at,
    is_draft
  ) values (
    tab_id,
    $report_default_size_card${"type":"doc","content":[{"type":"reportTitle","content":[{"text":"Size","type":"text"}]},{"type":"paragraph","content":[{"text":"This plan is ","type":"text"},{"type":"metric","attrs":{"type":"InlineMetric","metrics":[{"type":"total_area","subjectType":"fragments"}],"componentSettings":{"presentation":"total_area"}}},{"text":", which is ","type":"text"},{"type":"metric","attrs":{"type":"InlineMetric","metrics":[{"type":"total_area","subjectType":"fragments"},{"type":"total_area","subjectType":"geographies"}],"componentSettings":{"presentation":"percent_area"}}},{"text":" of the planning region.","type":"text"}]},{"type":"blockMetric","attrs":{"type":"GeographySizeTable","metrics":[{"type":"total_area","subjectType":"geographies"},{"type":"total_area","subjectType":"fragments"}],"componentSettings":{"presentation":"total_area","enableLayerToggles":true}}}]}$report_default_size_card$::jsonb,
    1,
    '{}'::jsonb,
    '{"type": "textBlock"}'::jsonb,
    now(),
    true
  ),
  (
    tab_id,
    $report_default_attributes_card${"type":"doc","content":[{"type":"reportTitle","content":[{"text":"Attributes","type":"text"}]},{"type":"blockMetric","attrs":{"type":"SketchAttributesTable","metrics":[],"componentSettings":{}}}]}$report_default_attributes_card$::jsonb,
    2,
    '{}'::jsonb,
    '{"type": "textBlock"}'::jsonb,
    now(),
    true
  );

  -- Same validation and snapshot copy as Publish (TOC layers, outputs, etc.); no session check —
  -- invoke only from trusted backend code (see publish_report_snapshot).
  perform public.publish_report_snapshot(new_report.id);

  return new_report;
end;
$$;


CREATE OR REPLACE FUNCTION public.create_project(name text, slug text, OUT project public.projects) RETURNS public.projects
    LANGUAGE plpgsql STRICT SECURITY DEFINER
    AS $$
  begin
    if current_setting('session.email_verified', true) = 'true' then
      insert into projects (name, slug, is_listed, creator_id, support_email) 
        values (name, slug, false, current_setting('session.user_id', true)::int, current_setting('session.canonical_email', true)) returning * into project;
      insert into project_participants (
        user_id, 
        project_id, 
        is_admin, 
        approved, 
        share_profile
      ) values (
        current_setting('session.user_id', true)::int, 
        project.id, 
        true, 
        true, 
        true
      );
      perform add_default_basemaps(project.id);
      perform create_default_report(project.id);
    else
      raise exception 'Email must be verified to create a project';
    end if;
  end
$$;

CREATE OR REPLACE FUNCTION public.create_sketch_class_from_template("projectId" integer, template_sketch_class_id integer) RETURNS public.sketch_classes
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare 
      base sketch_classes;
      created sketch_classes;
      num_similarly_named int;
      new_name text;
      default_report_id integer;
      default_clipping_geography_id integer;
      enable_geography_clipping boolean;
    begin
      if session_is_admin("projectId") then
        select id into default_report_id from reports where project_id = "projectId";
        if default_report_id is null then
          select id into default_report_id from create_default_report("projectId"::integer);
        end if;
        select id into default_clipping_geography_id from project_geography where project_id = "projectId" order by (
          case
            when name like 'EEZ%' then 0
            when name like 'Exclusive Economic Zone%' then 0
            when client_template = 'eez' then 1
            else 2
          end
        ) limit 1;

        enable_geography_clipping = default_report_id is not null and default_clipping_geography_id is not null;
   
        select * into base from sketch_classes where id = template_sketch_class_id;
        if base is null then
          raise exception 'Sketch Class with id=% does not exist', template_sketch_class_id;
        end if;
        if base.is_template = false then
          raise exception 'Sketch Class with id=% is not a template', template_sketch_class_id;
        end if;
        -- TODO: add suffix to name if there are duplicates
        select count(*) into num_similarly_named from sketch_classes where project_id = "projectId" and form_element_id is null and name ~ (base.name || '( \(\d+\))?');
        new_name = base.name;
        if num_similarly_named > 0 then
          new_name = new_name || ' (' || num_similarly_named::text || ')';
        end if;
        insert into sketch_classes (project_id, name, geometry_type, allow_multi, geoprocessing_project_url, geoprocessing_client_name, geoprocessing_client_url, mapbox_gl_style, preprocessing_endpoint, preprocessing_project_url, is_geography_clipping_enabled) values ("projectId", new_name, base.geometry_type, base.allow_multi, base.geoprocessing_project_url, base.geoprocessing_client_name, base.geoprocessing_client_url, base.mapbox_gl_style, base.preprocessing_endpoint, base.preprocessing_project_url, enable_geography_clipping) returning * into created;
        perform initialize_sketch_class_form_from_template(created.id, (select id from forms where sketch_class_id = base.id));
        if default_report_id is not null then
          perform set_primary_report_for_sketch_class(created.id, default_report_id);
        end if;
        if default_clipping_geography_id is not null then
          insert into sketch_class_geographies (sketch_class_id, geography_id) values (created.id, default_clipping_geography_id);
        end if;
        return created;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

-- use create_default_report() to backfill default reports into all projects
do $$
declare
  project projects;
begin
  for project in select id from projects loop
    perform create_default_report(project.id);
  end loop;
end;
$$;

-- Sets projects.region during createProjectWithGeographies (same txn as inserts).
-- SECURITY DEFINER so RLS/column grants cannot block the creator's region update.
create or replace function public.set_project_region_bounds(
  p_project_id integer,
  p_minx double precision,
  p_miny double precision,
  p_maxx double precision,
  p_maxy double precision
) returns void
  language sql
  security definer
  set search_path to public
as $$
  update public.projects
  set region = st_setsrid(st_makeenvelope(p_minx, p_miny, p_maxx, p_maxy), 4326)
  where id = p_project_id;
$$;

revoke all on function public.set_project_region_bounds(integer, double precision, double precision, double precision, double precision) from public;
grant execute on function public.set_project_region_bounds(integer, double precision, double precision, double precision, double precision) to seasketch_user;

-- Block deleting a data layer while project geography clipping still references it (including
-- draft TOC deletes via _delete_table_of_contents_item, which removes the TOC row before the layer).
create or replace function public.prevent_delete_data_layer_if_referenced_by_geography_clipping()
  returns trigger
  language plpgsql
  set search_path to public
as $$
begin
  if exists (
    select 1
    from public.geography_clipping_layers g
    where g.data_layer_id = old.id
  ) then
    raise exception
      'This layer is used by geography clipping. Remove it from project geography settings before deleting this layer.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_delete_data_layer_geography_clipping on public.data_layers;
create trigger trg_prevent_delete_data_layer_geography_clipping
  before delete on public.data_layers
  for each row
  execute procedure public.prevent_delete_data_layer_if_referenced_by_geography_clipping();

revoke all on function public.prevent_delete_data_layer_if_referenced_by_geography_clipping() from public;

-- New-project flow: after geography template layers are cloned into the draft TOC, group them
-- under a single folder before publish. Invoked from createProjectWithGeographies only.
create or replace function public.nest_new_project_geography_draft_toc_under_folder(
  p_project_id integer
)
returns void
  language plpgsql
  security definer
  set search_path to public
as $$
declare
  folder_stable text;
  layer_rec record;
  i integer := 0;
begin
  if session_is_admin(p_project_id) is not true then
    raise exception 'Permission denied';
  end if;

  -- Draft overlay layers still at tree root (typical right after geography cloning).
  if not exists (
    select 1
    from table_of_contents_items
    where project_id = p_project_id
      and is_draft = true
      and is_folder = false
      and parent_stable_id is null
  ) then
    return;
  end if;

  folder_stable := create_stable_id();

  update table_of_contents_items
  set sort_index = sort_index + 1
  where project_id = p_project_id
    and is_draft = true
    and parent_stable_id is null;

  insert into table_of_contents_items (
    project_id,
    stable_id,
    parent_stable_id,
    title,
    is_folder,
    is_draft,
    show_radio_children,
    is_click_off_only,
    hide_children,
    translated_props,
    sort_index
  ) values (
    p_project_id,
    folder_stable,
    null,
    'Geography layers',
    true,
    true,
    false,
    false,
    false,
    '{}'::jsonb,
    0
  );

  for layer_rec in
    select id
    from table_of_contents_items
    where project_id = p_project_id
      and is_draft = true
      and is_folder = false
      and parent_stable_id is null
    order by sort_index asc, id asc
  loop
    perform update_table_of_contents_item_position(layer_rec.id, folder_stable, i);
    i := i + 1;
  end loop;
end;
$$;

comment on function public.nest_new_project_geography_draft_toc_under_folder(integer) is '@omit';

revoke all on function public.nest_new_project_geography_draft_toc_under_folder(integer) from public;
grant execute on function public.nest_new_project_geography_draft_toc_under_folder(integer) to seasketch_user;