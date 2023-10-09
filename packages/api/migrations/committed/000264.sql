--! Previous: sha1:c2dce2c77882cbe4e720f1d4342755ba70675e58
--! Hash: sha1:009d1682c8b8c500594f007e9feb10b9ca1b9d08

-- Enter migration here
drop function if exists data_upload_tasks_table_of_contents_item_stable_id;
create or replace function data_upload_tasks_table_of_contents_item_stable_ids(task data_upload_tasks)
  returns text[]
  security definer
  stable
  language sql
  as $$
    select array(select stable_id from table_of_contents_items where data_layer_id in (
      select id from data_layers where data_source_id in (
        (select id from data_sources where upload_task_id = task.id)
      )
    ));
  $$;


grant execute on function data_upload_tasks_table_of_contents_item_stable_ids to anon;
grant select on data_upload_tasks to seasketch_user;

CREATE OR REPLACE FUNCTION public.after_data_upload_task_insert_or_update_notify_subscriptions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  DECLARE
    slug text;
    event_topic text;
  BEGIN
  select projects.slug into slug from projects where id = NEW.project_id;
  select concat('graphql:project:', slug, ':dataUploadTasks') into event_topic;
  if OLD is null then
    perform pg_notify(event_topic, json_build_object('dataUploadTaskId', NEW.id, 'projectId', NEW.project_id, 'previousState', null)::text);
  else
    perform pg_notify(event_topic, json_build_object('dataUploadTaskId', NEW.id, 'projectId', NEW.project_id, 'previousState', OLD.state)::text);
  end if;
  return NEW;
  END;
$$;
