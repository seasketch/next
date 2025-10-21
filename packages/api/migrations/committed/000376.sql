--! Previous: sha1:29b0614709d50fa8ec02f68040a8e5cf399f265f
--! Hash: sha1:e5b2e1bb4044d3e81fa3355f0a0bed9289687a86

-- Enter migration here
alter table report_cards add column if not exists is_draft boolean not null default true;

drop table if exists report_card_layers cascade;
drop table if exists source_processing_jobs cascade;

create table if not exists source_processing_jobs (
  job_key text primary key default gen_random_uuid()::text,
  progress_percentage integer not null default 0,
  progress_message text,
  state spatial_metric_state not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  logs_url text,
  logs_expires_at timestamptz,
  data_source_id integer not null references data_sources(id) on delete cascade,
  project_id integer not null references projects(id) on delete cascade
);

-- Create join table linking report cards to TOC items by stable_id
CREATE TABLE IF NOT EXISTS public.report_card_layers (
  report_card_id integer NOT NULL references report_cards(id) on delete cascade,
  table_of_contents_item_id integer NOT NULL references table_of_contents_items(id) on delete cascade,
  group_by text
);
CREATE INDEX IF NOT EXISTS report_card_layers_table_of_contents_item_id_idx
  ON public.report_card_layers (table_of_contents_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS report_card_layers_unique_report_card_id_table_of_contents_item_id_idx
  ON public.report_card_layers (report_card_id, table_of_contents_item_id);

COMMENT ON CONSTRAINT report_card_layers_table_of_contents_item_id_fkey
  ON public.report_card_layers IS E'@simpleCollections only';

COMMENT ON CONSTRAINT report_card_layers_report_card_id_fkey
  ON public.report_card_layers IS E'@simpleCollections only';

-- Validation trigger: ensure referenced stable_id exists, and refers to an allowed data source type
CREATE OR REPLACE FUNCTION public.before_insert_or_update_report_card_layers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Validate stable_id exists on a TOC item within the same project as the report card's report
  IF NOT EXISTS (
    SELECT 1
    FROM public.report_cards rc
    JOIN public.report_tabs rtab ON rtab.id = rc.report_tab_id
    JOIN public.reports r ON r.id = rtab.report_id
    JOIN public.table_of_contents_items t ON t.id = NEW.table_of_contents_item_id AND t.project_id = r.project_id
    WHERE rc.id = NEW.report_card_id
  ) THEN
    RAISE EXCEPTION 'Invalid table of contents item id %: no matching TOC item in the same project as the report card', NEW.table_of_contents_item_id;
  END IF;

  -- Validate data source type is allowed for at least one matching TOC item with a data layer, in same project
  IF NOT EXISTS (
    SELECT 1
    FROM public.report_cards rc
    JOIN public.report_tabs rtab ON rtab.id = rc.report_tab_id
    JOIN public.reports r ON r.id = rtab.report_id
    JOIN public.table_of_contents_items t ON t.id = NEW.table_of_contents_item_id AND t.project_id = r.project_id
    WHERE rc.id = NEW.report_card_id
      AND t.data_layer_id IS NOT NULL
      AND public.data_source_type(t.data_layer_id) IN ('seasketch-mvt', 'seasketch-vector', 'seasketch-raster')
  ) THEN
    RAISE EXCEPTION 'table of contents item id % does not reference a supported data layer type in the same project', NEW.table_of_contents_item_id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS before_insert_or_update_report_card_layers_trigger ON public.report_card_layers;
CREATE TRIGGER before_insert_or_update_report_card_layers_trigger
  BEFORE INSERT OR UPDATE ON public.report_card_layers
  FOR EACH ROW EXECUTE FUNCTION public.before_insert_or_update_report_card_layers();


grant all on public.report_card_layers to seasketch_user;
alter table public.report_card_layers disable row level security;

drop policy if exists report_card_layers_select on report_card_layers;
drop policy if exists report_card_layers_admin on report_card_layers;


drop function if exists report_card_is_draft;

drop type if exists public.report_card_layer cascade;
drop type if exists public.reporting_layer cascade;
create type public.reporting_layer as (
  table_of_contents_item_id integer,
  title text,
  type text,
  meta jsonb,
  mapbox_gl_styles jsonb,
  group_by text,
  processing_job_id text
);

drop function if exists report_cards_layers cascade;
drop function if exists report_cards_reporting_layers;
CREATE OR REPLACE FUNCTION public.report_cards_reporting_layers(rc public.report_cards)
RETURNS SETOF reporting_layer
LANGUAGE sql STABLE SECURITY DEFINER PARALLEL SAFE
COST 1 ROWS 1
AS $$
  select
    t.id as table_of_contents_item_id,
    t.title,
    t.data_source_type,
    ds.geostats,
    dl.mapbox_gl_styles,
    rcl.group_by,
    spj.job_key as processing_job_id
  from table_of_contents_items t
  join data_layers dl on dl.id = t.data_layer_id
  join data_sources ds on ds.id = dl.data_source_id
  join report_card_layers rcl on rcl.table_of_contents_item_id = t.id and rcl.report_card_id = rc.id
  left join source_processing_jobs spj on spj.data_source_id = dl.data_source_id
  where t.id in (
    select table_of_contents_item_id from report_card_layers where report_card_id = rc.id
  )
    and t.is_draft = rc.is_draft
  limit 1;
$$;

grant execute on function report_cards_reporting_layers to anon;
comment on function report_cards_reporting_layers is '@simpleCollections only';


CREATE OR REPLACE FUNCTION public.publish_report(sketch_class_id integer) RETURNS public.sketch_classes
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      published_sketch_class sketch_classes;
      new_report reports;
      draft_report_id int;
      project_id int;
      new_report_id int;
      new_tab_id int;
      old_report_id int;
      new_report_card_id int;
      source_card report_cards;
      published_toc_item_id int;
      source_url text;
      published_source_id int;
      original_source_id int;
      rcl report_card_layers;
    begin
      -- Note that this function copies many columns by name, much like the 
      -- data layers table of contents publishing function. Like it, we will
      -- need to update this function regularly as columns are added or removed.
      
      -- Get the draft report id and project id
      select sc.draft_report_id, sc.project_id 
      from sketch_classes sc 
      where sc.id = sketch_class_id 
      into draft_report_id, project_id;
      
      -- Check authorization
      if not session_is_admin(project_id) then
        raise exception 'You are not authorized to publish this report';
      end if;
      
      -- Check that there is an existing draft report
      if draft_report_id is null then
        raise exception 'No draft report exists for this sketch class';
      end if;
      
      -- Get the current published report id (if any)
      select sc.report_id from sketch_classes sc where sc.id = sketch_class_id into old_report_id;
      
      -- Create a new report by copying the draft report
      insert into reports (project_id, sketch_class_id)
      select reports.project_id, reports.sketch_class_id
      from reports 
      where id = draft_report_id
      returning * into new_report;
      
      new_report_id := new_report.id;
      
      -- Copy all report tabs from draft to new report
      for new_tab_id in 
        select rt.id 
        from report_tabs rt 
        where rt.report_id = draft_report_id 
        order by rt.position
      loop
        declare
          new_tab_id_copy int;
          old_tab_id int;
        begin
          old_tab_id := new_tab_id;
          
          -- Insert the tab and get the new tab id
          insert into report_tabs (report_id, title, position, alternate_language_settings, updated_at)
          select new_report_id, title, position, alternate_language_settings, updated_at
          from report_tabs 
          where id = old_tab_id
          returning id into new_tab_id_copy;
          
          -- Copy all cards for this tab
          -- loop through all existing report_cards in the old tab, creating new
          -- non-draft report_cards in the new tab, and copying report_card_layers
          for source_card in
            select * from report_cards 
            where report_tab_id = old_tab_id
            order by position
          loop
            insert into report_cards (report_tab_id, body, position, alternate_language_settings, component_settings, type, tint, icon, updated_at, is_draft)
            values (
              new_tab_id_copy,
              source_card.body, 
              source_card.position, 
              source_card.alternate_language_settings, 
              source_card.component_settings, 
              source_card.type, 
              source_card.tint, 
              source_card.icon,
              source_card.updated_at,
              false
            ) returning id into new_report_card_id;

            for rcl in
              select * from report_card_layers where report_card_id = source_card.id
            loop
              -- get the associated data source for the referenced draft tocitem
              select data_source_id into original_source_id from data_layers where id = (
                select data_layer_id from table_of_contents_items where id = rcl.table_of_contents_item_id
              ) limit 1;
              select 
                url into source_url 
              from 
                data_sources where id = original_source_id;
              
              if original_source_id is null then
                raise exception 'original_source_id is null';
              end if;
              if source_url is null then
                raise exception 'source_url is null';
              end if;

              -- ensure there is a published counterpart to the draft toc item
              select
                id into published_toc_item_id
              from
                table_of_contents_items
              where
                is_draft = false and
                data_layer_id in (
                  select
                    id
                  from
                    data_layers
                  where
                    data_source_id in (
                      select id from data_sources where url = source_url
                    )
                )
              limit 1;
              if published_toc_item_id is null then
                raise exception 'This report references data layers that have not yet been published. Please publish the layer list first.';
              end if;

              select data_source_id into published_source_id from data_layers where id = (
                select data_layer_id from table_of_contents_items where id = published_toc_item_id
              ) limit 1;
              if published_source_id is null then
                raise exception 'published_source_id is null';
              end if;

              -- copy data_upload_output with type = 'ReportingFlatgeobufV1' for the 
              -- published source replacing any that already exist.
              delete from data_upload_outputs where data_source_id = published_source_id and type = 'ReportingFlatgeobufV1'::data_upload_output_type;
              insert into data_upload_outputs (
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
                fgb_header_size
              ) select
                published_source_id,
                data_upload_outputs.project_id,
                type,
                url,
                remote,
                is_original,
                size,
                filename,
                original_filename,
                is_custom_upload,
                fgb_header_size
              from data_upload_outputs where data_source_id = original_source_id and type = 'ReportingFlatgeobufV1'::data_upload_output_type;
              insert into report_card_layers (report_card_id, table_of_contents_item_id, group_by)
              values (
                new_report_card_id,
                published_toc_item_id,
                rcl.group_by
              );
            end loop;
          end loop;
        end;
      end loop;
      
      -- Delete the current published report if it exists
      if old_report_id is not null then
        delete from reports where id = old_report_id;
      end if;
      
      -- Update sketch_class to point to the new published report
      update sketch_classes 
      set report_id = new_report_id 
      where id = sketch_class_id;
      
      -- Return the updated sketch class
      select * from sketch_classes where id = sketch_class_id into published_sketch_class;
      return published_sketch_class;
    end;
  $$;

drop function if exists add_report_card(integer, jsonb, text, jsonb);
drop function if exists add_report_card(integer, jsonb, text, jsonb, report_layer_input[]);
drop type if exists report_layer_input cascade;
create type report_layer_input as (
  table_of_contents_item_id integer,
  report_card_id integer,
  group_by text
);

CREATE OR REPLACE FUNCTION public.add_report_card(report_tab_id integer, component_settings jsonb, card_type text, body jsonb, layers report_layer_input[]) RETURNS public.report_cards
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      new_card report_cards;
      tab_report_id int;
      is_published_target boolean;
    begin
      if session_is_admin((select project_id from reports where id = (select report_id from report_tabs where id = add_report_card.report_tab_id))) then
        -- Determine if the target tab belongs to the published or draft report
        select report_id from report_tabs where id = add_report_card.report_tab_id into tab_report_id;
        is_published_target := exists (
          select 1
          from sketch_classes sc
          join reports r on r.sketch_class_id = sc.id
          where r.id = tab_report_id
            and sc.report_id = tab_report_id
        );

        if is_published_target then
          raise exception 'You cannot add a card to a published report';
        end if;

        insert into report_cards (
          report_tab_id,
          position,
          component_settings,
          type,
          body
        ) values (
          add_report_card.report_tab_id,
          coalesce((select max(position) from report_cards where report_cards.report_tab_id = add_report_card.report_tab_id), 0) + 1,
          add_report_card.component_settings,
          add_report_card.card_type,
          add_report_card.body
        ) returning * into new_card;

        insert into report_card_layers (report_card_id, table_of_contents_item_id, group_by)
        select 
          new_card.id,
          layer.table_of_contents_item_id,
          layer.group_by
        from unnest(add_report_card.layers) as layer;
        return new_card;
      else
        raise exception 'You are not authorized to add a card to this report';
      end if;
    end;
  $$;

grant execute on function add_report_card to seasketch_user;

CREATE INDEX IF NOT EXISTS data_upload_outputs_data_source_id_idx
  ON public.data_upload_outputs (data_source_id);

drop index if exists data_upload_outputs_lookup_idx;

drop function if exists available_report_layers;
drop function if exists projects_available_report_layers;
-- create or replace function projects_available_report_layers(project projects)
-- returns setof reporting_layer
-- language plpgsql
-- stable
-- security definer
-- as $$
--   declare
--     toc_item_ids integer[];
--   begin
--     if session_is_admin(project.id) then
--       return query select distinct on (t.id)
--         t.title,
--         t.id as table_of_contents_item_id,
--         o.type,
--         case o.type when 'ReportingFlatgeobufV1' then o.url else null end,
--         o.remote,
--         o.size,
--         ds.geostats,
--         dl.mapbox_gl_styles,
--         null as group_by,
--         spj.job_key as processing_job_id
--       from table_of_contents_items t
--       inner join data_layers dl on dl.id = t.data_layer_id
--       inner join data_upload_outputs o on o.data_source_id = dl.data_source_id
--       inner join data_sources ds on ds.id = dl.data_source_id
--       left join source_processing_jobs spj on spj.data_source_id = dl.data_source_id
--       where t.id in (
--         select id from table_of_contents_items where project_id = project.id and data_layer_id is not null and is_draft = true and data_source_type(data_layer_id) in ('seasketch-mvt', 'seasketch-vector', 'seasketch-raster')
--       ) and t.is_draft = true and o.type in ('ReportingFlatgeobufV1','FlatGeobuf','GeoJSON', 'GeoTIFF')
--       order by t.id, case o.type when 'ReportingFlatgeobufV1' then 0 when 'FlatGeobuf' then 1 when 'GeoJSON' then 2 else 3 end
--       ;
--     else
--       raise exception 'You are not authorized to view available report layers';
--     end if;
--   end;
-- $$;
create or replace function projects_available_report_layers(project projects)
returns setof table_of_contents_items
language plpgsql
stable
security definer
as $$
  declare
    toc_item_ids integer[];
  begin
    if session_is_admin(project.id) then
      return query select * from table_of_contents_items where data_source_type in ('seasketch-mvt', 'seasketch-vector', 'seasketch-raster') and is_draft = true and project_id = project.id;
    else
      raise exception 'You are not authorized to view available report layers';
    end if;
  end;
$$;


grant execute on function projects_available_report_layers to seasketch_user;
comment on function projects_available_report_layers is '@simpleCollections only';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'spatial_metrics'
      and column_name = 'overlay_source_remote'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'spatial_metrics'
      and column_name = 'overlay_source_url'
  ) then
    alter table spatial_metrics rename column overlay_source_remote to overlay_source_url;
  end if;
end $$;

alter table spatial_metrics add column if not exists overlay_source_type text constraint overlay_source_type_check check (overlay_source_type in ('FlatGeobuf', 'GeoJSON', 'GeoTIFF'));

CREATE OR REPLACE FUNCTION public.get_metrics_for_geography(geography_id integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  begin
    if not session_has_project_access((select project_id from project_geography where id = geography_id limit 1)) then
      raise exception 'Permission denied';
    end if;
    return (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'type', type,
          'updatedAt', updated_at,
          'createdAt', created_at,
          'value', value,
          'state', state,
          'sourceUrl', overlay_source_url,
          'sourceType', extension_to_source_type(overlay_source_url),
          'groupBy', overlay_group_by,
          'includedProperties', included_properties,
          'subject', jsonb_build_object('id', subject_geography_id, '__typename', 'GeographySubject'),
          'errorMessage', error_message,
          'progress', progress_percentage,
          'jobKey', job_key,
          'sourceProcessingJobDependency', source_processing_job_dependency
        )
      )
      from spatial_metrics
      where subject_geography_id = geography_id
    );
  end;
  $$;


CREATE OR REPLACE FUNCTION public.get_metrics_for_sketch(skid integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    hash_fragments text[];
  begin
    policy_passed := check_sketch_rls_policy(skid);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;
    select array_agg(hash) into hash_fragments
    from get_fragment_ids_for_sketch_recursive(skid);
    return (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'type', type,
          'updatedAt', updated_at,
          'createdAt', created_at,
          'value', value,
          'state', state,
          'sourceUrl', overlay_source_url,
          'sourceType', extension_to_source_type(overlay_source_url),
          'groupBy', overlay_group_by,
          'includedProperties', included_properties,
          'subject', jsonb_build_object('hash', subject_fragment_id, 'sketches', (select array_agg(sketch_id) from sketch_fragments where fragment_hash = subject_fragment_id), 'geographies', (select array_agg(geography_id) from fragment_geographies where fragment_hash = subject_fragment_id), '__typename', 'FragmentSubject'),
          'errorMessage', error_message,
          'progress', progress_percentage,
          'jobKey', job_key,
          'sourceProcessingJobDependency', source_processing_job_dependency
        )
      )
      from spatial_metrics
      where subject_fragment_id = any(hash_fragments)
      and subject_geography_id is null
    );
  end;
  $$;

drop function if exists get_or_create_spatial_metric;

create or replace function get_state_for_spatial_metric(metric_id bigint) returns spatial_metric_state
    language plpgsql
    security definer
    stable
    as $$
    begin
        return (select state from spatial_metrics where id = metric_id);
    end;
    $$;

grant execute on function get_state_for_spatial_metric to anon;

drop function if exists extension_to_source_type;
create or replace function extension_to_source_type(url text) returns text
  language sql
  stable
  as $$
    with base as (
      select split_part(url, '?', 1) as base
    ), parts as (
      select string_to_array(base, '.') as parts from base
    ), ext as (
      select lower(parts[array_length(parts, 1)]) as ext from parts
    )
    select case when ext = 'fgb' then 'FlatGeobuf' when ext = 'geojson' then 'GeoJSON' when ext in ('tif','tiff') then 'GeoTIFF' else null end from ext;
  $$;

grant execute on function extension_to_source_type to anon;

CREATE OR REPLACE FUNCTION public.get_spatial_metric(metric_id bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    subj_geography_id integer;
    subj_fragment_id text;
  begin
    select subject_geography_id, subject_fragment_id into subj_geography_id, subj_fragment_id
    from spatial_metrics
    where id = metric_id;
    if current_user not in ('graphile_worker', 'postgres') then
      if subj_geography_id is not null then
        if not session_has_project_access((select project_id from project_geography where id = subj_geography_id limit 1)) then
          raise exception 'Permission denied';
        end if;
      else
        policy_passed := check_sketch_rls_policy((select sketch_id from sketch_fragments where fragment_hash = subj_fragment_id limit 1));
        if not policy_passed then
          raise exception 'Permission denied';
        end if;
      end if;
    end if;
    return (
      select jsonb_build_object(
        'id', id,
        'type', type,
        'updatedAt', updated_at,
        'createdAt', created_at,
        'value', value,
        'state', state,
        'sourceUrl', overlay_source_url,
        'sourceType', extension_to_source_type(overlay_source_url),
        'groupBy', overlay_group_by,
        'includedProperties', included_properties,
        'jobKey', job_key,
        'subject', 
        case when subject_geography_id is not null then
          jsonb_build_object('id', subject_geography_id, '__typename', 'GeographySubject')
        else
          jsonb_build_object('hash', subject_fragment_id, 'sketches', (select array_agg(sketch_id) from sketch_fragments where fragment_hash = subject_fragment_id), 'geographies', (select array_agg(geography_id) from fragment_geographies where fragment_hash = subject_fragment_id), '__typename', 'FragmentSubject')
        end,
        'errorMessage', error_message,
        'progress', progress_percentage,
        'sourceProcessingJobDependency', source_processing_job_dependency
      ) from spatial_metrics where id = metric_id
    );
  end;
  $$;

-- Return multiple spatial metrics as a JSONB array, preserving input order
CREATE OR REPLACE FUNCTION public.get_spatial_metrics(metric_ids bigint[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  begin
    return (
      select coalesce(
        jsonb_agg(get_spatial_metric(id) order by ord),
        '[]'::jsonb
      )
      from unnest(metric_ids) with ordinality as t(id, ord)
    );
  end;
  $$;

grant execute on function get_spatial_metrics to anon;

comment on function get_spatial_metrics is '@omit';




create index if not exists source_processing_jobs_data_source_id_idx on public.source_processing_jobs (data_source_id);

create index if not exists source_processing_jobs_updated_at_idx on public.source_processing_jobs (updated_at);

create index if not exists source_processing_jobs_project_id_idx on public.source_processing_jobs (project_id);

alter table spatial_metrics add column if not exists source_processing_job_dependency text references source_processing_jobs(job_key) on delete cascade;

-- Require a source URL or dependency for non-total_area metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spatial_metrics_requires_source_or_dependency'
  ) THEN
    ALTER TABLE public.spatial_metrics
      ADD CONSTRAINT spatial_metrics_requires_source_or_dependency
      CHECK (
        type = 'total_area'
        OR overlay_source_url IS NOT NULL
        OR source_processing_job_dependency IS NOT NULL
      ) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.retry_failed_spatial_metrics(metric_ids bigint[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric spatial_metrics;
    updated_metric_id bigint;
    metric_id bigint;
    job_dep text;
    existing_job_state spatial_metric_state;
  begin
    -- loop through the metric ids, and update the state to queued
    foreach metric_id in array metric_ids loop
      update spatial_metrics set state = 'queued', error_message = null, updated_at = now(), created_at = now(), progress_percentage = 0, job_key = gen_random_uuid()::text where id = metric_id returning id into updated_metric_id;
      if updated_metric_id is not null then
        -- if this metric depends on a source_processing_job, restart it first
        select source_processing_job_dependency into job_dep from spatial_metrics where id = updated_metric_id;
        if job_dep is not null then
          select state into existing_job_state from source_processing_jobs where job_key = job_dep;
          if existing_job_state = 'error' then
            delete from source_processing_jobs where job_key = job_dep;
          end if;
        end if;
        perform graphile_worker.add_job(
          'calculateSpatialMetric',
          json_build_object('metricId', updated_metric_id),
          max_attempts := 1,
          job_key := 'calculateSpatialMetric:' || updated_metric_id,
          job_key_mode := 'replace'
        );
      end if;
    end loop;
    return true;
  end;
  $$;

alter table data_upload_outputs add column if not exists fgb_header_size integer;

DROP TRIGGER IF EXISTS validate_spatial_metrics_constraints_trigger ON public.spatial_metrics;
DROP FUNCTION IF EXISTS public.validate_spatial_metrics_constraints;

-- Add unique constraint to ensure only one job per data_source_id
ALTER TABLE public.source_processing_jobs 
ADD CONSTRAINT source_processing_jobs_data_source_id_unique UNIQUE (data_source_id);

-- Add dependency_not_ready enum value to spatial_metric_state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'spatial_metric_state'
      AND e.enumlabel = 'dependency_not_ready'
  ) THEN
    ALTER TYPE public.spatial_metric_state ADD VALUE 'dependency_not_ready';
  END IF;
END $$;

grant select on source_processing_jobs to seasketch_user;

alter table source_processing_jobs enable row level security;

create policy source_processing_jobs_select on source_processing_jobs for select using (session_is_admin(project_id));

create or replace function projects_source_processing_jobs(p projects)
returns setof source_processing_jobs
language plpgsql
security definer
stable
as $$
  begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
  return query select * from source_processing_jobs where project_id = p.id;
  end;
$$;

grant execute on function projects_source_processing_jobs to seasketch_user;
comment on function projects_source_processing_jobs is '@simpleCollections only';

drop trigger if exists trigger_source_processing_job_subscription_trigger on public.source_processing_jobs;
drop function if exists trigger_source_processing_job_subscription;
-- Create trigger function to notify GraphQL subscriptions when source processing jobs are updated
CREATE OR REPLACE FUNCTION public.trigger_report_overlay_source_subscription()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  STABLE
  AS $$
  BEGIN
    -- Notify GraphQL subscription for source processing job updates
    PERFORM pg_notify(
      'graphql:projects:' || NEW.project_id || ':reportOverlaySources',
      '{"jobKey": "' || NEW.job_key || '", "projectId": ' || NEW.project_id || ', "dataSourceId": ' || NEW.data_source_id || '}'
    );
    RETURN NEW;
  END;
  $$;

-- Create trigger to call the subscription function when source_processing_jobs are updated
CREATE TRIGGER trigger_report_overlay_source_subscription_trigger
  AFTER UPDATE OR INSERT ON public.source_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_report_overlay_source_subscription();


create or replace function source_processing_jobs_layer_title(job source_processing_jobs)
returns text
language sql
security definer
stable
as $$
    select title from table_of_contents_items where data_layer_id = (select id from data_layers where data_source_id = job.data_source_id) limit 1;
$$;

grant execute on function source_processing_jobs_layer_title to anon;

-- Create trigger function to queue calculateSpatialMetric jobs when source processing jobs complete
CREATE OR REPLACE FUNCTION public.trigger_queue_spatial_metrics_on_source_complete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    metric_record RECORD;
    completed_source_url text;
  BEGIN
    IF NEW.state = 'complete' AND (OLD.state IS NULL OR OLD.state != 'complete') THEN
      -- get the completed source url
      select url into completed_source_url from data_upload_outputs where type = 'ReportingFlatgeobufV1'::data_upload_output_type and data_source_id = NEW.data_source_id limit 1;
      if completed_source_url is null then
        raise exception 'Completed source url not found';
      end if;
      -- Find all spatial_metrics that depend on this source processing job
      FOR metric_record IN 
        SELECT id 
        FROM spatial_metrics 
        WHERE source_processing_job_dependency = NEW.job_key
      LOOP
        -- update the spatial_metrics with the completed source url
        update spatial_metrics set overlay_source_url = completed_source_url, state = 'queued' where id = metric_record.id;
        -- Queue a calculateSpatialMetric job for each dependent metric
        PERFORM graphile_worker.add_job(
          'calculateSpatialMetric',
          json_build_object('metricId', metric_record.id),
          max_attempts := 1,
          job_key := 'calculateSpatialMetric:' || metric_record.id,
          job_key_mode := 'replace'
        );
      END LOOP;
    END IF;
    IF NEW.state = 'error' AND (OLD.state IS NULL OR OLD.state != 'error') THEN
      -- update the spatial_metrics with the error message
      update spatial_metrics set state = 'error', error_message = 'Error processing source dependency.' where source_processing_job_dependency = NEW.job_key;
    END IF;
    
    RETURN NEW;
  END;
  $$;

-- Create trigger to call the function when source_processing_jobs are updated
CREATE TRIGGER trigger_queue_spatial_metrics_on_source_complete_trigger
  AFTER UPDATE ON public.source_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_queue_spatial_metrics_on_source_complete();

drop function if exists recalculate_spatial_metrics;
create or replace function recalculate_spatial_metrics(metric_ids bigint[], preprocess_sources boolean)
returns boolean
language plpgsql
security definer
as $$
  declare
    metric_id bigint;
    source_id integer;
    source_url text;
    source_job_key text;
  begin
    if nullif(current_setting('session.user_id', true), '') is null then
      raise exception 'User not authenticated';
    end if;
    foreach metric_id in array metric_ids loop
      if preprocess_sources then
        select overlay_source_url into source_url from spatial_metrics where id = metric_id;
        if source_url is not null then
          for source_id in (select data_source_id from data_upload_outputs where url = source_url and type = 'ReportingFlatgeobufV1'::data_upload_output_type) loop
          -- TODO: this is going to end up running the source processing job multiple times if there are multiple metrics that depend on it
            delete from source_processing_jobs where data_source_id = source_id;
            delete from data_upload_outputs where data_source_id = source_id and type = 'ReportingFlatgeobufV1'::data_upload_output_type;
            -- create a new source processing job
            insert into source_processing_jobs (data_source_id, project_id) values (source_id, (select project_id from data_sources where id = source_id)) returning job_key into source_job_key;
            -- trigger preprocessSource job for this data source
            perform graphile_worker.add_job(
              'preprocessSource',
              json_build_object('jobKey', source_job_key),
              max_attempts := 1,
              job_key := 'preprocessSource:' || source_id::text,
              job_key_mode := 'replace'
            );
          end loop;
        end if;
      end if;
      delete from spatial_metrics where id = metric_id and (subject_fragment_id is not null or session_is_admin((select project_id from project_geography where id = spatial_metrics.subject_geography_id limit 1)));
    end loop;
    return true;
  end;
$$;

grant execute on function recalculate_spatial_metrics to seasketch_user;

alter table spatial_metrics drop column if exists overlay_layer_stable_id;
alter table spatial_metrics drop column if exists overlay_source_type;
alter table spatial_metrics drop column if exists overlay_type;



create or replace function reporting_layer_source_processing_job(l reporting_layer)
  returns source_processing_jobs
  language sql
  security definer
  stable
  as $$
    select * from source_processing_jobs where job_key = l.processing_job_id limit 1;
  $$;

grant execute on function reporting_layer_source_processing_job to anon;

create index if not exists source_processing_jobs_job_key_idx on public.source_processing_jobs (job_key);

CREATE OR REPLACE FUNCTION public.sketch_classes_my_sketches(sk sketch_classes) RETURNS SETOF public.sketches
    LANGUAGE sql STABLE
    AS $$
    select
      *
    from
      sketches
    where
      it_me(user_id) and sketch_class_id = sk.id
  $$;

grant execute on function sketch_classes_my_sketches to seasketch_user;

comment on function sketch_classes_my_sketches is '@simpleCollections only';


CREATE OR REPLACE FUNCTION public.session_has_project_access(pid integer) RETURNS boolean
    LANGUAGE sql STABLE 
    SECURITY DEFINER
    PARALLEL SAFE
    AS $$
    -- Here we give access if the project is public, if the session is an admin,
    -- or if the session belongs to an approved participant
    select exists(
      select
        1
      from 
        projects 
      where 
        projects.id = pid and 
        access_control = 'public'
    ) or 
    session_is_admin(pid) or 
    session_is_approved_participant(pid) or  
    -- session has a survey invite token with matching projectId
    exists(
      select
        1
      from
        survey_invites
      inner join
        surveys
      on
        surveys.id = survey_invites.survey_id
      where
        surveys.project_id = pid and 
        (
          survey_invites.user_id = nullif(current_setting('session.user_id', TRUE), '')::int or
          (
            survey_invites.email = nullif(current_setting('session.canonical_email', TRUE), '') and
            current_setting('session.email_verified', true) = 'true'
          ) or
          survey_invites.email = nullif(current_setting('session.survey_invite_email', TRUE), '')
        )            
    )
  $$;


CREATE OR REPLACE FUNCTION public._session_has_toc_access(item_id integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    PARALLEL SAFE
    AS $$
WITH toc AS (
  SELECT id, path
  FROM table_of_contents_items
  WHERE id = item_id AND NOT is_draft
),
parents AS (
  SELECT parent.id
  FROM table_of_contents_items parent, toc
  WHERE parent.path @> toc.path AND NOT parent.is_draft
),
acls AS (
  SELECT acl.id
  FROM access_control_lists acl
  JOIN parents p ON p.id = acl.table_of_contents_item_id
  WHERE acl.type != 'public'
)
SELECT
  COALESCE(bool_and(session_on_acl(id)), EXISTS (SELECT 1 FROM toc))
FROM acls;
$$;

CREATE INDEX IF NOT EXISTS rcl_report_card_id_only
  ON public.report_card_layers (report_card_id);

ALTER ROLE seasketch_user SET jit = off;
ALTER ROLE anon SET jit = off;
ALTER ROLE graphile SET jit = off;
ALTER ROLE seasketch_superuser SET jit = off;

drop function if exists table_of_contents_items_report_layer_output;

drop function if exists reporting_layers_processed_output;
create or replace function report_card_layers_processed_output(layer report_card_layers)
  returns data_upload_outputs
  language sql
  security definer
  stable
  as $$
    select * from data_upload_outputs where data_source_id = (select data_source_id from data_layers where id = (select data_layer_id from table_of_contents_items where id = layer.table_of_contents_item_id)) and type = 'ReportingFlatgeobufV1'::data_upload_output_type limit 1;
  $$;

grant execute on function report_card_layers_processed_output to anon;

-- Trigger to ensure a preprocess job exists for report card layers without processed output
CREATE OR REPLACE FUNCTION public.trigger_queue_preprocess_source_on_rcl()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    existing_output_id integer;
    ds_id integer;
    source_processing_job_key text;
  BEGIN
    -- Determine data source id for the referenced TOC item
    SELECT data_source_id INTO ds_id
    FROM data_layers
    WHERE id = (
      SELECT data_layer_id
      FROM table_of_contents_items
      WHERE id = NEW.table_of_contents_item_id
    );

    -- If we can't resolve a data source, do nothing
    IF ds_id IS NULL THEN
      raise exception 'No data source found for table of contents item %', NEW.table_of_contents_item_id;
      RETURN NEW;
    END IF;

    
    
    -- If no existing source processing job exists, enqueue a preprocess job for this data source
    IF (SELECT COUNT(*) FROM source_processing_jobs WHERE data_source_id = ds_id) = 0 THEN
      insert into source_processing_jobs (data_source_id, project_id) values (ds_id, (select project_id from data_sources where id = ds_id)) returning job_key into source_processing_job_key;
      PERFORM graphile_worker.add_job(
        'preprocessSource',
        json_build_object('jobKey', source_processing_job_key),
        max_attempts := 1
      );
    END IF;
    return new;
  END;
  $$;

DROP TRIGGER IF EXISTS trigger_queue_preprocess_source_on_rcl_trigger ON public.report_card_layers;
CREATE TRIGGER trigger_queue_preprocess_source_on_rcl_trigger
  AFTER INSERT OR UPDATE ON public.report_card_layers
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_queue_preprocess_source_on_rcl();

create or replace function reports_geographies(r reports)
returns setof project_geography
language sql
security definer
stable
as $$
  select * from project_geography where project_id = r.project_id;
$$;

grant execute on function reports_geographies to anon;

comment on function reports_geographies is '@simpleCollections only';

alter table source_processing_jobs add column if not exists data_upload_output_id integer references data_upload_outputs(id) on delete cascade;

alter table spatial_metrics add column if not exists project_id integer not null references projects(id) on delete cascade;

create index if not exists spatial_metrics_project_id_idx on public.spatial_metrics (project_id);

alter table source_processing_jobs add column if not exists eta timestamptz;
alter table source_processing_jobs add column if not exists started_at timestamptz;
alter table source_processing_jobs add column if not exists completed_at timestamptz;

alter table spatial_metrics add column if not exists eta timestamptz;
alter table spatial_metrics add column if not exists started_at timestamptz;
alter table spatial_metrics add column if not exists completed_at timestamptz;

create or replace function report_card_ids_for_report(rid integer)
returns setof int
language sql
security definer
stable
as $$
  select id from report_cards where report_tab_id in (select id from report_tabs where report_id = rid);
$$;

grant execute on function report_card_ids_for_report to anon;
comment on function report_card_ids_for_report is '@omit';

alter table data_upload_outputs enable row level security;
grant select on data_upload_outputs to anon;

drop policy if exists data_upload_outputs_select on data_upload_outputs;
create policy data_upload_outputs_select on data_upload_outputs for select using (
  session_is_admin(project_id) or 
  (
    session_has_project_access(project_id) and _session_on_toc_item_acl(
      ( SELECT table_of_contents_items.path
        FROM table_of_contents_items
        WHERE ((table_of_contents_items.is_draft = false) AND (table_of_contents_items.data_layer_id = (select id from data_layers where data_source_id = data_upload_outputs.data_source_id)))
      )
    )
  )
);

comment on table data_upload_outputs is '@omit';

-- Drop old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'spatial_metrics_unique_metric'
  ) THEN
    ALTER TABLE public.spatial_metrics DROP CONSTRAINT spatial_metrics_unique_metric;
  END IF;
END $$;

-- Drop old indexes if they exist so we can recreate them
DROP INDEX IF EXISTS spatial_metrics_fragment_unique_idx;
DROP INDEX IF EXISTS spatial_metrics_geography_unique_idx;
DROP INDEX IF EXISTS spatial_metrics_lookup_idx;


-- Create unique indexes for spatial_metrics that handle NULL values properly
-- We need separate partial indexes for different NULL combinations since standard
-- UNIQUE constraints treat NULLs as distinct

-- Fragment-based metrics (subject_fragment_id NOT NULL, subject_geography_id IS NULL)
CREATE UNIQUE INDEX spatial_metrics_fragment_unique_idx
  ON public.spatial_metrics (subject_fragment_id, type, COALESCE(overlay_source_url, ''), COALESCE(overlay_group_by, ''))
  WHERE subject_fragment_id IS NOT NULL AND subject_geography_id IS NULL;

-- Geography-based metrics (subject_geography_id NOT NULL, subject_fragment_id IS NULL)
CREATE UNIQUE INDEX spatial_metrics_geography_unique_idx
  ON public.spatial_metrics (subject_geography_id, type, COALESCE(overlay_source_url, ''), COALESCE(overlay_group_by, ''))
  WHERE subject_geography_id IS NOT NULL AND subject_fragment_id IS NULL;

create or replace function get_or_create_spatial_metric(
  p_subject_fragment_id text,
  p_subject_geography_id integer,
  p_type spatial_metric_type,
  p_overlay_source_url text,
  p_overlay_group_by text,
  p_included_properties text[],
  p_source_processing_job_dependency text,
  p_project_id integer
) returns jsonb
language plpgsql
security definer
as $$
  declare
    metric_id bigint;
  begin
    if p_subject_fragment_id is not null and p_subject_geography_id is not null then
      raise exception 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
    end if;
    if p_subject_fragment_id is null and p_subject_geography_id is null then
      raise exception 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
    end if;
    if p_type is null then
      raise exception 'type parameter is required';
    end if;
    if (p_overlay_source_url is null and p_source_processing_job_dependency is null) and p_type != 'total_area' then
      raise exception 'overlay_source_url or source_processing_job_dependency parameter is required for non-total_area metrics';
    end if;
    
    -- Try to find existing metric first
    if p_subject_fragment_id is not null then
      select id into metric_id from spatial_metrics
      where subject_fragment_id = p_subject_fragment_id
        and subject_geography_id is null
        and type = p_type
        and coalesce(overlay_source_url, '') = coalesce(p_overlay_source_url, '')
        and coalesce(overlay_group_by, '') = coalesce(p_overlay_group_by, '');
    else
      select id into metric_id from spatial_metrics
      where subject_geography_id = p_subject_geography_id
        and subject_fragment_id is null
        and type = p_type
        and coalesce(overlay_source_url, '') = coalesce(p_overlay_source_url, '')
        and coalesce(overlay_group_by, '') = coalesce(p_overlay_group_by, '');
    end if;
    
    -- If not found, insert new metric
    if metric_id is null then
      insert into spatial_metrics (
        subject_fragment_id, 
        subject_geography_id, 
        type, 
        overlay_source_url, 
        overlay_group_by, 
        included_properties, 
        source_processing_job_dependency,
        project_id
      ) values (
        p_subject_fragment_id, 
        p_subject_geography_id, 
        p_type, 
        p_overlay_source_url, 
        p_overlay_group_by, 
        p_included_properties, 
        p_source_processing_job_dependency,
        p_project_id
      ) returning id into metric_id;
    end if;
    
    return (select get_spatial_metric(metric_id));
  end;
$$;

grant execute on function get_or_create_spatial_metric to anon;

comment on function get_or_create_spatial_metric is '@omit';

grant select on report_cards to anon;
comment on table report_cards is '@omit';


drop policy if exists reports_select on reports;
create policy reports_select on reports for select using (
  session_is_admin(project_id) or session_has_project_access(project_id)
);

delete from spatial_metrics;


CREATE OR REPLACE FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      lid int;
      item table_of_contents_items;
      source_id int;
      copied_source_id int;
      acl_type access_control_list_type;
      acl_id int;
      orig_acl_id int;
      new_toc_id int;
      new_interactivity_settings_id int;
      new_source_id integer;
      ref record;
    begin
      -- check permissions
      if session_is_admin("projectId") = false then
        raise 'Permission denied. Must be a project admin';
      end if;

      -- create a temporary table of report_card_layer references so that 
      -- existing published reports aren't broken by the publish operation.
      CREATE TEMP TABLE _rcl_snapshot (
        report_card_id integer,
        table_of_contents_item_id integer,
        group_by text,
        stable_id text
      ) ON COMMIT DROP;

      INSERT INTO _rcl_snapshot (report_card_id, table_of_contents_item_id, group_by, stable_id)
      SELECT
        rcl.report_card_id,
        rcl.table_of_contents_item_id,
        rcl.group_by,
        tci.stable_id
      FROM public.report_card_layers rcl
      JOIN public.table_of_contents_items tci
        ON tci.id = rcl.table_of_contents_item_id
      WHERE rcl.report_card_id in (
        select id from report_cards where report_tab_id in (
          select id from report_tabs where report_id in (
            select id from reports where project_id = "projectId"
          )
        )
      ) and tci.is_draft = false;

      if ((select count(*) from _rcl_snapshot) = 0) then
        raise exception 'No report card layers referenced by published reports were found';
      end if;
    
      -- delete existing published table of contents items, layers, sources, and interactivity settings
      delete from 
        interactivity_settings 
      where
        id in (
          select 
            data_layers.interactivity_settings_id
          from
            data_layers
          inner JOIN
            table_of_contents_items
          on
            data_layers.id = table_of_contents_items.data_layer_id
          where
            table_of_contents_items.project_id = "projectId" and
            is_draft = false
        );

      delete from data_sources where data_sources.id in (
        select 
          data_source_id 
        from
          data_layers
        inner JOIN
          table_of_contents_items
        on
          data_layers.id = table_of_contents_items.data_layer_id
        where
          table_of_contents_items.project_id = "projectId" and
          is_draft = false
      );
      delete from data_layers where id in (
        select 
          data_layer_id 
        from 
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = false
      );
      delete from 
        table_of_contents_items 
      where 
        project_id = "projectId" and 
        is_draft = false;

      -- one-by-one, copy related layers and link table of contents items
      for item in 
        select 
          * 
        from 
          table_of_contents_items 
        where 
          is_draft = true and 
          project_id = "projectId"
      loop
        if item.is_folder = false then
          -- copy interactivity settings first
          insert into interactivity_settings (
            type,
            short_template,
            long_template,
            cursor,
            title
          ) select
              type,
              short_template,
              long_template,
              cursor,
              title
            from
              interactivity_settings
            where
              interactivity_settings.id = (
                select interactivity_settings_id from data_layers where data_layers.id = item.data_layer_id
              )
            returning
              id
            into
              new_interactivity_settings_id;

          insert into data_layers (
            project_id,
            data_source_id,
            source_layer,
            sublayer,
            sublayer_type,
            render_under,
            mapbox_gl_styles,
            interactivity_settings_id,
            z_index
          )
          select "projectId", 
            data_source_id, 
            source_layer, 
            sublayer, 
            sublayer_type,
            render_under, 
            mapbox_gl_styles,
            new_interactivity_settings_id,
            z_index
          from 
            data_layers
          where 
            id = item.data_layer_id
          returning id into lid;
        else
          lid = item.data_layer_id;
        end if;
        -- TODO: this will have to be modified with the addition of any columns
        insert into table_of_contents_items (
          is_draft,
          project_id,
          path,
          stable_id,
          parent_stable_id,
          title,
          is_folder,
          show_radio_children,
          is_click_off_only,
          metadata,
          bounds,
          data_layer_id,
          sort_index,
          hide_children,
          geoprocessing_reference_id,
          translated_props,
          enable_download
        ) values (
          false,
          "projectId",
          item.path,
          item.stable_id,
          item.parent_stable_id,
          item.title,
          item.is_folder,
          item.show_radio_children,
          item.is_click_off_only,
          item.metadata,
          item.bounds,
          lid,
          item.sort_index,
          item.hide_children,
          item.geoprocessing_reference_id,
          item.translated_props,
          item.enable_download
        ) returning id into new_toc_id;
        select 
          type, id into acl_type, orig_acl_id 
        from 
          access_control_lists 
        where 
          table_of_contents_item_id = (
            select 
              id 
            from 
              table_of_contents_items 
            where is_draft = true and stable_id = item.stable_id
          );
        -- copy access control list settings
        if acl_type != 'public' then
          update 
            access_control_lists 
          set type = acl_type 
          where table_of_contents_item_id = new_toc_id 
          returning id into acl_id;
          if acl_type = 'group' then
            insert into 
              access_control_list_groups (
                access_control_list_id, 
                group_id
              ) 
            select 
              acl_id, 
              group_id 
            from 
              access_control_list_groups 
            where 
              access_control_list_id = orig_acl_id;
          end if;
        end if;
      end loop;
      -- one-by-one, copy related sources and update foreign keys of layers
      for source_id in
        select distinct(data_source_id) from data_layers where id in (
          select 
            data_layer_id 
          from 
            table_of_contents_items 
          where 
            is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
        )
      loop
        -- TODO: This function will have to be updated whenever the schema 
        -- changes since these columns are hard coded... no way around it.
        insert into data_sources (
          project_id,
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id,
          translated_props,
          arcgis_fetch_strategy,
          created_by
        )
          select 
            "projectId", 
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id,
          translated_props,
          arcgis_fetch_strategy,
          created_by
          from 
            data_sources 
          where
            id = source_id
          returning id into copied_source_id;
        -- copy data_upload_outputs
        insert into data_upload_outputs (
          data_source_id,
          project_id,
          type,
          created_at,
          url,
          remote,
          is_original,
          size,
          filename,
          original_filename
        ) select 
            copied_source_id,
            project_id,
            type,
            created_at,
            url,
            remote,
            is_original,
            size,
            filename,
            original_filename
          from 
            data_upload_outputs 
          where 
            data_source_id = source_id;
        -- update data_layers that should now reference the copy
        update 
          data_layers 
        set data_source_id = copied_source_id 
        where 
          data_source_id = source_id and
          data_layers.id in ((
            select distinct(data_layer_id) from table_of_contents_items where is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
          ));
      end loop;
      update 
        projects 
      set 
        draft_table_of_contents_has_changes = false, 
        table_of_contents_last_published = now() 
      where 
        id = "projectId";

      -- restore report_card_layers that were referenced by the published report
      for ref in select * from _rcl_snapshot loop
        select id into new_toc_id from table_of_contents_items where stable_id = ref.stable_id and is_draft = false and project_id = "projectId";
        if new_toc_id is null then
          raise exception 'Table of contents item with stable_id % not found', ref.stable_id;
        end if;
        if new_toc_id is not null then
          insert into report_card_layers (report_card_id, group_by, table_of_contents_item_id) values (ref.report_card_id, ref.group_by, new_toc_id);
        end if;
      end loop;
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;
