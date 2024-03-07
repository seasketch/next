--! Previous: sha1:62c0687190ac27bb6403a83230067117e73a0749
--! Hash: sha1:9fa95ed7e44ca0954ad43975fea3d58453d6bcfe

-- Enter migration here
CREATE OR REPLACE FUNCTION public.submit_data_upload(id uuid) RETURNS public.project_background_jobs
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      job project_background_jobs;
      pid integer;
    begin
      select 
        project_id 
      into
        pid
      from 
        project_background_jobs 
      where 
        project_background_jobs.id = submit_data_upload.id;
      if session_is_admin(pid) then
        update 
          project_background_jobs 
        set 
          state = 'running', 
          progress_message = 'uploaded' 
        where 
          project_background_jobs.id = submit_data_upload.id 
        returning * into job;
        perform graphile_worker.add_job(
          'processDataUpload', 
          json_build_object('jobId', job.id), 
          max_attempts := 1
        );
        return job;
      else
        raise exception 'permission denied.';
      end if;
    end;
  $$;
