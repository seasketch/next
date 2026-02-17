--! Previous: sha1:756bdd43eba27dfd38508e9870c66b164667b277
--! Hash: sha1:5696a5443c24120a1c679f4090b7abc377013624

-- Enter migration here
DELETE FROM data_upload_outputs WHERE is_reporting_type(type);
delete from source_processing_jobs ;
 delete from spatial_metrics ;
 delete from report_cards;

-- Fix FK on spatial_metrics.source_processing_job_dependency to include ON UPDATE CASCADE.
-- The original FK (created in migration 000376) only had ON DELETE CASCADE, which caused
-- retry_failed_source_processing_job to fail when updating source_processing_jobs.job_key
-- while other spatial_metrics still referenced the old key.
ALTER TABLE spatial_metrics
  DROP CONSTRAINT IF EXISTS spatial_metrics_source_processing_job_dependency_fkey;

ALTER TABLE spatial_metrics
  ADD CONSTRAINT spatial_metrics_source_processing_job_dependency_fkey
  FOREIGN KEY (source_processing_job_dependency)
  REFERENCES source_processing_jobs(job_key)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Fix FK on data_upload_outputs.source_processing_job_key to include ON UPDATE CASCADE.
-- Without this, retry_failed_source_processing_job must manually nullify ALL
-- data_upload_outputs (including published copies) before changing the job_key.
-- With ON UPDATE CASCADE, published copies automatically get the new key while
-- keeping their existing URL (data file), preserving published report functionality.
ALTER TABLE data_upload_outputs
  DROP CONSTRAINT IF EXISTS data_upload_outputs_source_processing_job_key_fkey;

ALTER TABLE data_upload_outputs
  ADD CONSTRAINT data_upload_outputs_source_processing_job_key_fkey
  FOREIGN KEY (source_processing_job_key)
  REFERENCES source_processing_jobs(job_key)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Enforce that reporting-type data_upload_outputs must always have a
-- source_processing_job_key. Using NOT VALID so existing rows aren't checked
-- (in case production has stale nulls from the previous bug).
ALTER TABLE data_upload_outputs
  DROP CONSTRAINT IF EXISTS data_upload_outputs_reporting_requires_job_key;

ALTER TABLE data_upload_outputs
  ADD CONSTRAINT data_upload_outputs_reporting_requires_job_key
  CHECK (
    type NOT IN ('ReportingCOG', 'ReportingFlatgeobufV1')
    OR source_processing_job_key IS NOT NULL
  ) NOT VALID;

-- Fix retry_failed_source_processing_job: DELETE draft reporting outputs instead
-- of nullifying source_processing_job_key (which would violate the new constraint).
-- Published copies are untouched (different data_source_id) and ON UPDATE CASCADE
-- on the FK handles updating their key when source_processing_jobs.job_key changes.
CREATE OR REPLACE FUNCTION public.retry_failed_source_processing_job(jobkey text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    updated_job_key text;
  begin
    -- Delete reporting-type outputs for the draft data source. They will be
    -- recreated when preprocessing completes. Published copies (which have a
    -- different data_source_id) are left untouched.
    delete from data_upload_outputs
      where source_processing_job_key = jobkey
        and data_source_id = (select data_source_id from source_processing_jobs where job_key = jobkey)
        and is_reporting_type(type);
    update source_processing_jobs set state = 'queued', error_message = null, updated_at = now(), created_at = now(), progress_percentage = 0, job_key = gen_random_uuid()::text where job_key = jobkey returning job_key into updated_job_key;
    if updated_job_key is not null then
      update spatial_metrics set source_processing_job_dependency = updated_job_key where source_processing_job_dependency = jobkey;
      perform graphile_worker.add_job(
        'preprocessSource',
        json_build_object('jobKey', updated_job_key),
        max_attempts := 1
      );
    end if;
    return true;
  end;
  $$;

-- Also fix recalculate_spatial_metrics to explicitly delete all spatial_metrics
-- referencing a source_processing_job before retrying it. This line was present in
-- migration 000378 but was accidentally removed in 000387.
CREATE OR REPLACE FUNCTION public.recalculate_spatial_metrics(metric_ids bigint[], preprocess_sources boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric_id bigint;
    source_id integer;
    source_url text;
    source_job_key text;
    source_preprocessing_jobs text[];
  begin
    if nullif(current_setting('session.user_id', true), '') is null then
      raise exception 'User not authenticated';
    end if;
    foreach metric_id in array metric_ids loop
      if preprocess_sources then
        select source_processing_job_dependency into source_job_key from spatial_metrics where id = metric_id;
        if source_job_key is not null then
          source_preprocessing_jobs = array_append(source_preprocessing_jobs, source_job_key);
        end if;
      end if;
      delete from spatial_metrics where id = metric_id and (subject_fragment_id is not null or session_is_admin((select project_id from project_geography where id = spatial_metrics.subject_geography_id limit 1)));
    end loop;
    if array_length(source_preprocessing_jobs, 1) > 0 then
      -- loop through the source preprocessing jobs, and retry them
      foreach source_job_key in array source_preprocessing_jobs loop
        select data_source_id into source_id from source_processing_jobs where job_key = source_job_key;
        if source_id is not null then
          delete from data_upload_outputs where data_source_id = source_id and is_reporting_type(type);
        end if;
        delete from spatial_metrics where source_processing_job_dependency = source_job_key;
        perform retry_failed_source_processing_job(source_job_key);
      end loop;
    end if;
    return true;
  end;
$$;
