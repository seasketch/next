--! Previous: sha1:b36dcf179468a00d504503e3b30db784d847b01a
--! Hash: sha1:c47bf43a267561562d6547dfa1f07b01a42de4c5

-- Enter migration here

-- Standalone helper used by the reprocess task
create or replace function is_convertible_legacy_source(data_source_id int)
  returns boolean
  language sql
  security definer
  as $$
    select (url like '%cloudfront%' and (uploaded_source_filename like '%json%' or uploaded_source_filename like '%.fgb' or uploaded_source_filename like '%.zip'))
    from data_sources
    where id = data_source_id;
  $$;

grant execute on function is_convertible_legacy_source to seasketch_user;

create or replace function data_sources_is_convertible_legacy_source(data_source data_sources)
  returns boolean
  language sql
  stable
  security definer
  as $$
    select (data_source.url like '%cloudfront%' and (data_source.uploaded_source_filename like '%json%' or data_source.uploaded_source_filename like '%.fgb' or data_source.uploaded_source_filename like '%.zip'));
  $$;

grant execute on function data_sources_is_convertible_legacy_source to anon;

-- Mutation that admins can call to reprocess a legacy data source through the
-- current upload pipeline, creating a new versioned data_source record.
create or replace function reprocess_legacy_data_source(table_of_contents_item_id int)
  returns project_background_jobs
  language plpgsql
  security definer
  as $$
  declare
    item table_of_contents_items;
    source data_sources;
    job project_background_jobs;
    content_type text;
    session_user_id int;
  begin
    session_user_id := nullif(current_setting('session.user_id', true), '')::integer;

    select * into item
      from table_of_contents_items
      where id = reprocess_legacy_data_source.table_of_contents_item_id;

    if not session_is_admin(item.project_id) then
      raise exception 'Permission denied';
    end if;

    select ds.* into source
      from data_sources ds
      join data_layers dl on dl.data_source_id = ds.id
      where dl.id = item.data_layer_id;

    if not is_convertible_legacy_source(source.id) then
      raise exception 'Data source is not a convertible legacy source';
    end if;

    -- Guard against duplicate active jobs for this layer
    if exists (
      select 1
      from data_upload_tasks
      join project_background_jobs on project_background_jobs.id = data_upload_tasks.project_background_job_id
      where
        data_upload_tasks.replace_table_of_contents_item_id = reprocess_legacy_data_source.table_of_contents_item_id
        and project_background_jobs.state in ('queued', 'running')
    ) then
      raise exception 'There is already an active reprocess job for this layer';
    end if;

    content_type := case
      when source.uploaded_source_filename like '%.fgb' then 'application/octet-stream'
      when source.uploaded_source_filename like '%.zip' then 'application/zip'
      else 'application/json'
    end;

    insert into project_background_jobs (
      project_id,
      title,
      user_id,
      type,
      timeout_at
    ) values (
      item.project_id,
      'Reprocessing ' || source.uploaded_source_filename,
      session_user_id,
      'data_upload',
      timezone('utc'::text, now()) + interval '30 minutes'
    ) returning * into job;

    insert into data_upload_tasks (
      filename,
      content_type,
      project_background_job_id,
      replace_table_of_contents_item_id,
      changelog
    ) values (
      source.uploaded_source_filename,
      content_type,
      job.id,
      reprocess_legacy_data_source.table_of_contents_item_id,
      'Source was reprocessed by SeaSketch in order to support new cartography and reporting features'
    );

    perform graphile_worker.add_job(
      'reprocessLegacyDataSource',
      json_build_object('jobId', job.id),
      max_attempts := 1,
      job_key := 'reprocess-legacy:' || reprocess_legacy_data_source.table_of_contents_item_id::text
    );

    return job;
  end;
  $$;

grant execute on function reprocess_legacy_data_source to seasketch_user;

-- Superuser-only batch mutation that queues a reprocess job for every draft
-- table_of_contents_item in the project whose data source is a convertible
-- legacy source and does not already have an active job running.
-- Returns the number of jobs queued.
create or replace function reprocess_all_legacy_data_sources(project_id int)
  returns int
  language plpgsql
  security definer
  as $$
  declare
    item_id int;
    queued int := 0;
  begin
    if not session_is_superuser() then
      raise exception 'Permission denied';
    end if;

    for item_id in
      select toc.id
      from table_of_contents_items toc
      join data_layers dl on dl.id = toc.data_layer_id
      join data_sources ds on ds.id = dl.data_source_id
      where toc.project_id = reprocess_all_legacy_data_sources.project_id
        and toc.is_draft = true
        and is_convertible_legacy_source(ds.id)
        and not exists (
          select 1
          from data_upload_tasks dut
          join project_background_jobs pbj on pbj.id = dut.project_background_job_id
          where dut.replace_table_of_contents_item_id = toc.id
            and pbj.state in ('queued', 'running')
        )
    loop
      perform reprocess_legacy_data_source(item_id);
      queued := queued + 1;
    end loop;

    return queued;
  end;
  $$;

grant execute on function reprocess_all_legacy_data_sources to seasketch_user;
