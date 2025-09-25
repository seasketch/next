-- Enter migration here

alter table report_cards add column if not exists is_draft boolean not null default true;

drop table if exists report_card_layers cascade;
-- Create join table linking report cards to TOC items by stable_id
CREATE TABLE IF NOT EXISTS public.report_card_layers (
  report_card_id integer NOT NULL,
  toc_stable_id text NOT NULL,
  group_by text
);

-- Add primary key constraint if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'report_card_layers_pkey'
  ) THEN
    ALTER TABLE public.report_card_layers
      ADD CONSTRAINT report_card_layers_pkey PRIMARY KEY (report_card_id, toc_stable_id);
  END IF;
END $$;

-- FK to report_cards with ON DELETE CASCADE (handles cleanup when a report_card is deleted)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_card_layers_report_card_id_fkey'
  ) THEN
    ALTER TABLE public.report_card_layers
      ADD CONSTRAINT report_card_layers_report_card_id_fkey
      FOREIGN KEY (report_card_id) REFERENCES public.report_cards(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index to efficiently find layers by stable_id
CREATE INDEX IF NOT EXISTS report_card_layers_toc_stable_id_idx
  ON public.report_card_layers (toc_stable_id);

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
    JOIN public.table_of_contents_items t ON t.stable_id = NEW.toc_stable_id AND t.project_id = r.project_id
    WHERE rc.id = NEW.report_card_id
  ) THEN
    RAISE EXCEPTION 'Invalid toc_stable_id %: no matching TOC item in the same project as the report card', NEW.toc_stable_id;
  END IF;

  -- Validate data source type is allowed for at least one matching TOC item with a data layer, in same project
  IF NOT EXISTS (
    SELECT 1
    FROM public.report_cards rc
    JOIN public.report_tabs rtab ON rtab.id = rc.report_tab_id
    JOIN public.reports r ON r.id = rtab.report_id
    JOIN public.table_of_contents_items t ON t.stable_id = NEW.toc_stable_id AND t.project_id = r.project_id
    WHERE rc.id = NEW.report_card_id
      AND t.data_layer_id IS NOT NULL
      AND public.data_source_type(t.data_layer_id) IN ('seasketch-mvt', 'seasketch-vector', 'seasketch-raster')
  ) THEN
    RAISE EXCEPTION 'toc_stable_id % does not reference a supported data layer type in the same project', NEW.toc_stable_id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS before_insert_or_update_report_card_layers_trigger ON public.report_card_layers;
CREATE TRIGGER before_insert_or_update_report_card_layers_trigger
  BEFORE INSERT OR UPDATE ON public.report_card_layers
  FOR EACH ROW EXECUTE FUNCTION public.before_insert_or_update_report_card_layers();

-- Draft-only cascade: when a draft TOC item is deleted, remove join records for draft report cards only
CREATE OR REPLACE FUNCTION public.after_delete_toc_items_cascade_report_card_layers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.is_draft THEN
    DELETE FROM public.report_card_layers rcl
    USING public.report_cards rc,
          public.report_tabs rtab,
          public.reports r
    WHERE rcl.toc_stable_id = OLD.stable_id
      AND rc.id = rcl.report_card_id
      AND rc.is_draft = true;
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS toc_items_report_card_layers_draft_cascade ON public.table_of_contents_items;
CREATE TRIGGER toc_items_report_card_layers_draft_cascade
  AFTER DELETE ON public.table_of_contents_items
  FOR EACH ROW EXECUTE FUNCTION public.after_delete_toc_items_cascade_report_card_layers();

grant all on public.report_card_layers to seasketch_user;
alter table public.report_card_layers enable row level security;

drop policy if exists report_card_layers_select on report_card_layers;
drop policy if exists report_card_layers_admin on report_card_layers;

create policy report_card_layers_select on report_card_layers for select using (
  session_has_project_access((select project_id from table_of_contents_items where stable_id = toc_stable_id limit 1))
);

create policy report_card_layers_admin on report_card_layers for all to seasketch_user using (
  session_is_admin((select project_id from table_of_contents_items where stable_id = toc_stable_id limit 1))
);

drop function if exists report_card_is_draft;

drop type if exists public.report_card_layer cascade;
drop type if exists public.reporting_layer cascade;
create type public.reporting_layer as (
  stable_id text,
  title text,
  table_of_contents_item_id integer,
  type data_upload_output_type,
  url text,
  remote text,
  size bigint,
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
  with upload_outputs as (
    select 
      data_source_id,
      type,
      url,
      remote,
      size,
      case when type = 'ReportingFlatgeobufV1' then true else false end as is_report_ready
    from data_upload_outputs
    where type in ('ReportingFlatgeobufV1', 'FlatGeobuf', 'GeoJSON', 'GeoTIFF')
    order by case type when 'ReportingFlatgeobufV1' then 0 else 1 end
  )
  select
    t.stable_id,
    t.title,
    t.id as table_of_contents_item_id,
    o.type,
    case o.is_report_ready when true then o.url else null end,
    case o.is_report_ready when true then o.remote else null end,
    o.size,
    ds.geostats,
    dl.mapbox_gl_styles,
    rcl.group_by,
    spj.job_key as processing_job_id
  from table_of_contents_items t
  join data_layers dl on dl.id = t.data_layer_id
  left join upload_outputs o on o.data_source_id = dl.data_source_id
  join data_sources ds on ds.id = dl.data_source_id
  join report_card_layers rcl on rcl.toc_stable_id = t.stable_id and rcl.report_card_id = rc.id
  left join source_processing_jobs spj on spj.data_source_id = dl.data_source_id
  where t.stable_id in (
    select toc_stable_id from report_card_layers where report_card_id = rc.id
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
            insert into report_card_layers (report_card_id, toc_stable_id, group_by)
            select 
              new_report_card_id,
              rcl.toc_stable_id,
              rcl.group_by
            from report_card_layers rcl
            where rcl.report_card_id = source_card.id;
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
  toc_stable_id text,
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

        insert into report_card_layers (report_card_id, toc_stable_id, group_by)
        select 
          new_card.id,
          layer.toc_stable_id,
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
create or replace function projects_available_report_layers(project projects)
returns setof reporting_layer
language plpgsql
stable
security definer
as $$
  declare
    toc_item_ids integer[];
  begin
    if session_is_admin(project.id) then
      return query select distinct on (t.id)
        t.stable_id,
        t.title,
        t.id as table_of_contents_item_id,
        o.type,
        case o.type when 'ReportingFlatgeobufV1' then o.url else null end,
        o.remote,
        o.size,
        ds.geostats,
        dl.mapbox_gl_styles,
        null as group_by,
        spj.job_key as processing_job_id
      from table_of_contents_items t
      inner join data_layers dl on dl.id = t.data_layer_id
      inner join data_upload_outputs o on o.data_source_id = dl.data_source_id
      inner join data_sources ds on ds.id = dl.data_source_id
      left join source_processing_jobs spj on spj.data_source_id = dl.data_source_id
      where t.id in (
        select id from table_of_contents_items where project_id = project.id and data_layer_id is not null and is_draft = true and data_source_type(data_layer_id) in ('seasketch-mvt', 'seasketch-vector', 'seasketch-raster')
      ) and t.is_draft = true and o.type in ('ReportingFlatgeobufV1','FlatGeobuf','GeoJSON', 'GeoTIFF')
      order by t.id, case o.type when 'ReportingFlatgeobufV1' then 0 when 'FlatGeobuf' then 1 when 'GeoJSON' then 2 else 3 end
      ;
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
          'stableId', overlay_layer_stable_id,
          'sourceUrl', overlay_source_url,
          'sourceType', overlay_source_type,
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
          'stableId', overlay_layer_stable_id,
          'sourceUrl', overlay_source_url,
          'sourceType', overlay_source_type,
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
drop function if exists get_or_create_spatial_metrics_for_fragments;

CREATE FUNCTION public.get_or_create_spatial_metric(
  p_subject_fragment_id text DEFAULT NULL::text, 
  p_subject_geography_id integer DEFAULT NULL::integer, 
  p_type public.spatial_metric_type DEFAULT NULL::public.spatial_metric_type, p_overlay_layer_stable_id text DEFAULT NULL::text, 
  p_overlay_source_url text DEFAULT NULL::text, 
  p_overlay_source_type text DEFAULT NULL::text, 
  p_overlay_group_by text DEFAULT NULL::text, 
  p_included_properties text[] DEFAULT NULL::text[], 
  p_overlay_type public.metric_overlay_type DEFAULT NULL::public.metric_overlay_type
  ) RETURNS public.spatial_metrics
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    metric spatial_metrics;
    found_metric boolean := false;
BEGIN
    -- Validate that exactly one subject ID is provided and type is not null
    IF (p_subject_fragment_id IS NULL AND p_subject_geography_id IS NULL) OR 
       (p_subject_fragment_id IS NOT NULL AND p_subject_geography_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
    END IF;
    
    IF p_type IS NULL THEN
        RAISE EXCEPTION 'type parameter is required';
    END IF;
    
    -- Try to find existing metric using comprehensive query that matches unique indexes
    IF p_subject_fragment_id IS NOT NULL THEN
        -- Fragment-based metric - check for existing record
        SELECT * INTO metric
        FROM spatial_metrics
        WHERE subject_fragment_id = p_subject_fragment_id
          AND type::text = p_type::text
          AND COALESCE(overlay_layer_stable_id, '') = COALESCE(p_overlay_layer_stable_id, '')
          AND COALESCE(overlay_source_url, '') = COALESCE(p_overlay_source_url, '')
          AND COALESCE(overlay_group_by, '') = COALESCE(p_overlay_group_by, '')
          AND COALESCE(overlay_type::text, '') = COALESCE(p_overlay_type::text, '')
        ORDER BY created_at DESC
        LIMIT 1;
        
        found_metric := FOUND;
    ELSE
        -- Geography-based metric - check for existing record
        SELECT * INTO metric
        FROM spatial_metrics
        WHERE subject_geography_id = p_subject_geography_id
          AND type::text = p_type::text
          AND COALESCE(overlay_layer_stable_id, '') = COALESCE(p_overlay_layer_stable_id, '')
          AND COALESCE(overlay_source_url, '') = COALESCE(p_overlay_source_url, '')
          AND COALESCE(overlay_group_by, '') = COALESCE(p_overlay_group_by, '')
          AND COALESCE(overlay_type::text, '') = COALESCE(p_overlay_type::text, '')
        ORDER BY created_at DESC
        LIMIT 1;
        
        found_metric := FOUND;
    END IF;
    
    -- If found, return existing record
    IF found_metric THEN
        RETURN metric;
    END IF;
    
    -- If not found, create new metric
    INSERT INTO spatial_metrics (
        subject_fragment_id,
        subject_geography_id,
        type,
        overlay_layer_stable_id,
        overlay_source_url,
        overlay_source_type,
        overlay_group_by,
        included_properties,
        overlay_type
    ) VALUES (
        p_subject_fragment_id,
        p_subject_geography_id,
        p_type,
        p_overlay_layer_stable_id,
        p_overlay_source_url,
        p_overlay_source_type,
        p_overlay_group_by,
        p_included_properties,
        p_overlay_type
    ) RETURNING * INTO metric;
    
    RETURN metric;
END;
$$;

CREATE FUNCTION public.get_or_create_spatial_metrics_for_fragments(
  p_subject_fragments text[], 
  p_type public.spatial_metric_type DEFAULT NULL::public.spatial_metric_type,
  p_overlay_layer_stable_id text DEFAULT NULL::text,
  p_overlay_source_url text DEFAULT NULL::text,
  p_overlay_source_type text DEFAULT NULL::text,
  p_overlay_group_by text DEFAULT NULL::text,
  p_included_properties text[] DEFAULT NULL::text[],
  p_overlay_type public.metric_overlay_type DEFAULT NULL::public.metric_overlay_type
  ) RETURNS bigint[]
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    fragment_hash text;
    metric_row spatial_metrics;
    metric_ids bigint[] := ARRAY[]::bigint[];
BEGIN
    IF p_type IS NULL THEN
        RAISE EXCEPTION 'type parameter is required';
    END IF;

    IF p_subject_fragments IS NULL OR array_length(p_subject_fragments, 1) IS NULL THEN
        RETURN metric_ids;
    END IF;

    FOREACH fragment_hash IN ARRAY p_subject_fragments LOOP
        IF fragment_hash IS NULL THEN
            CONTINUE;
        END IF;
        metric_row := get_or_create_spatial_metric(
            p_subject_fragment_id => fragment_hash,
            p_subject_geography_id => NULL,
            p_type => p_type,
            p_overlay_layer_stable_id => p_overlay_layer_stable_id,
            p_overlay_source_url => p_overlay_source_url,
            p_overlay_source_type => p_overlay_source_type,
            p_overlay_group_by => p_overlay_group_by,
            p_included_properties => p_included_properties,
            p_overlay_type => p_overlay_type
        );
        metric_ids := array_append(metric_ids, metric_row.id);
    END LOOP;

    RETURN metric_ids;
END;
$$;

comment on function get_or_create_spatial_metrics_for_fragments is '@omit';
comment on function get_or_create_spatial_metric is '@omit';

grant execute on function get_or_create_spatial_metrics_for_fragments to anon;
grant execute on function get_or_create_spatial_metric to anon;

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
        'stableId', overlay_layer_stable_id,
        'sourceUrl', overlay_source_url,
        'sourceType', overlay_source_type,
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

-- Update data_upload_output_type enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'data_upload_output_type'
      AND e.enumlabel = 'ReportingFlatgeobufV1'
  ) THEN
    ALTER TYPE public.data_upload_output_type ADD VALUE 'ReportingFlatgeobufV1';
  END IF;
END $$;

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

create index if not exists source_processing_jobs_data_source_id_idx on public.source_processing_jobs (data_source_id);

create index if not exists source_processing_jobs_updated_at_idx on public.source_processing_jobs (updated_at);

create index if not exists source_processing_jobs_project_id_idx on public.source_processing_jobs (project_id);

alter table spatial_metrics add column if not exists source_processing_job_dependency text references source_processing_jobs(job_key) on delete cascade;

CREATE OR REPLACE FUNCTION public.retry_failed_spatial_metrics(metric_ids bigint[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric spatial_metrics;
    updated_metric_id bigint;
    metric_id bigint;
    job_dep text;
  begin
    -- loop through the metric ids, and update the state to queued
    foreach metric_id in array metric_ids loop
      update spatial_metrics set state = 'queued', error_message = null, updated_at = now(), created_at = now(), progress_percentage = 0, job_key = gen_random_uuid()::text where id = metric_id returning id into updated_metric_id;
      if updated_metric_id is not null then
        -- if this metric depends on a source_processing_job, restart it first
        select source_processing_job_dependency into job_dep from spatial_metrics where id = updated_metric_id;
        if job_dep is not null then
          update source_processing_jobs
          set state = 'queued',
              error_message = null,
              progress_percentage = 0,
              progress_message = null,
              updated_at = now()
          where job_key = job_dep and state = 'error';
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

-- Create trigger function to notify GraphQL subscriptions when source processing jobs are updated
CREATE OR REPLACE FUNCTION public.trigger_source_processing_job_subscription()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  STABLE
  AS $$
  BEGIN
    -- Notify GraphQL subscription for source processing job updates
    PERFORM pg_notify(
      'graphql:projects:' || NEW.project_id || ':sourceProcessingJobs',
      '{"jobKey": "' || NEW.job_key || '", "projectId": ' || NEW.project_id || '}'
    );
    RETURN NEW;
  END;
  $$;

-- Create trigger to call the subscription function when source_processing_jobs are updated
CREATE TRIGGER trigger_source_processing_job_subscription_trigger
  AFTER UPDATE ON public.source_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_source_processing_job_subscription();

