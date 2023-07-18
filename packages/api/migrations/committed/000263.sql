--! Previous: sha1:7532a83f30e3530fd5091ab490483159ff78d38d
--! Hash: sha1:c2dce2c77882cbe4e720f1d4342755ba70675e58

-- Enter migration here
DROP TRIGGER IF EXISTS data_upload_task_notify_subscriptions on public.data_upload_tasks;

CREATE OR REPLACE FUNCTION public.after_data_upload_task_insert_or_update_notify_subscriptions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  DECLARE
    slug text;
    event_topic text;
  BEGIN
  select projects.slug into slug from projects where id = NEW.project_id;
  select concat('graphql:project:', slug, ':dataUploadTasks') into event_topic;
  perform pg_notify(event_topic, json_build_object('dataUploadTaskId', NEW.id, 'projectId', NEW.project_id)::text);
  return NEW;
  END;
  $$;

CREATE TRIGGER data_upload_task_notify_subscriptions AFTER INSERT OR UPDATE ON public.data_upload_tasks FOR EACH ROW EXECUTE FUNCTION public.after_data_upload_task_insert_or_update_notify_subscriptions();
