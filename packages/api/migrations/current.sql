-- Enter migration here
alter type data_upload_output_type add value if not exists 'CSV';

alter table data_upload_tasks add column if not exists processing_options jsonb;

comment on column data_upload_tasks.processing_options is 'Format-specific processing instructions supplied by the client at upload time (e.g. column mapping and CRS for delimited text uploads). Consumed by the spatial-uploads-handler.';

drop function if exists create_data_upload(text, integer, text, integer);
CREATE OR REPLACE FUNCTION public.create_data_upload(filename text, project_id integer, content_type text, replace_table_of_contents_item_id integer, processing_options jsonb default null) RETURNS public.data_upload_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      upload data_upload_tasks;
      used bigint;
      quota bigint;
      job project_background_jobs;
    begin
      if session_is_admin(project_id) then
        select projects_data_hosting_quota_used(projects.*), projects_data_hosting_quota(projects.*) into used, quota from projects where id = project_id;
        if replace_table_of_contents_item_id is not null and (select exists(
          select 
            data_upload_tasks.id 
          from 
            data_upload_tasks 
          inner join 
            project_background_jobs 
          on 
            data_upload_tasks.project_background_job_id = project_background_jobs.id 
          where 
            data_upload_tasks.replace_table_of_contents_item_id is not null and 
            project_background_jobs.state in ('queued', 'running') and
            data_upload_tasks.replace_table_of_contents_item_id = create_data_upload.replace_table_of_contents_item_id
        )) then
          raise exception 'There is already an active upload task for this layer';
        end if;
        if quota - used > 0 then
          insert into project_background_jobs (
            project_id, 
            title, 
            user_id, 
            type,
            timeout_at
          ) values (
            project_id, 
            (
              case when replace_table_of_contents_item_id is not null then 'Replacement upload ' else '' end
            ) || filename, 
            nullif(current_setting('session.user_id', TRUE), '')::integer, 
            'data_upload',
            timezone('utc'::text, now()) + interval '15 minutes'
          )
          returning * into job;
          insert into data_upload_tasks(
            filename, 
            content_type, 
            project_background_job_id,
            replace_table_of_contents_item_id,
            processing_options
          ) values (
            create_data_upload.filename, 
            create_data_upload.content_type, 
            job.id,
            create_data_upload.replace_table_of_contents_item_id,
            create_data_upload.processing_options
          ) returning * into upload;
          return upload;
        else
          raise exception 'data hosting quota exceeded';
        end if;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function create_data_upload to seasketch_user;
