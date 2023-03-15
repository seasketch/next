--! Previous: sha1:1254ee21d353d9e03c3d6869c49cdb5560103bc9
--! Hash: sha1:b44789a85197b14ca5dd14c9731d184c4458b8ee

-- Enter migration here
create or replace function after_map_bookmark_insert_screenshot_trigger() 
  returns trigger 
  security definer
  language plpgsql
  as $$
    begin
      perform graphile_worker.add_job('createBookmarkScreenshot', json_build_object('id', NEW.id), job_key := 'createBookmarkScreenshot:' || NEW.id, max_attempts := 6);
      return new;
    end;
  $$;

DROP function if exists map_bookmarks_job;
DROP function if exists get_job_details;
DROP TYPE IF EXISTS worker_job;
CREATE TYPE worker_job AS (
  key text,
  task_identifier text,
  run_at timestamp with time zone,
  attempts int,
  max_attempts int,
  created_at timestamp with time zone,
  locked_at timestamp with time zone,
  last_error text
);

create or replace function get_job_details(key text)
  returns worker_job
  language plpgsql
  security definer
  as $$
    declare
      details worker_job;
    begin
    select
      get_job_details.key,
      graphile_worker.jobs.task_identifier,
      graphile_worker.jobs.run_at,
      graphile_worker.jobs.attempts,
      graphile_worker.jobs.max_attempts,
      graphile_worker.jobs.created_at,
      graphile_worker.jobs.locked_at,
      graphile_worker.jobs.last_error
    into
      details
    from
      graphile_worker.jobs
    where
      graphile_worker.jobs.key = get_job_details.key;
    return details;
    end;
  $$;


create or replace function map_bookmarks_job(bookmark map_bookmarks)
  returns worker_job
  language sql
  security definer
  stable
  as $$
    select get_job_details('createBookmarkScreenshot:' || bookmark.id);
  $$;

grant execute on function map_bookmarks_job to anon;


DROP POlicy if exists map_bookmarks_select on map_bookmarks;
CREATE POLICY map_bookmarks_select ON public.map_bookmarks TO anon USING (true);

grant select on table map_bookmarks to anon;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'worker_job_status') THEN
        create type worker_job_status as enum (
          'queued',
          'started',
          'finished',
          'error',
          'failed'
        );
    END IF;
    --more types here...
END$$;


alter table map_bookmarks add column if not exists screenshot_job_status worker_job_status not null default 'queued'::worker_job_status;

create or replace function on_map_bookmark_update() 
  returns trigger 
  security definer
  language plpgsql
  as $$
    begin
      perform pg_notify(concat('graphql:mapBookmark:', NEW.id, ':update'), json_build_object('bookmarkId', NEW.id)::text);
      return new;
    end;
  $$;

DROP TRIGGER IF EXISTS on_map_bookmark_update_trigger ON map_bookmarks;
CREATE TRIGGER on_map_bookmark_update_trigger
    AFTER UPDATE ON map_bookmarks
    FOR EACH ROW EXECUTE PROCEDURE on_map_bookmark_update();
