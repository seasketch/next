--! Previous: sha1:675e27f08d64b1e07cf9e41b4a908019c7c04dd9
--! Hash: sha1:79b8e45c7b33774e6b61ff71a062d430eae3af38

-- Enter migration here
Drop trigger if exists post_after_insert_notify_subscriptions on posts;

CREATE OR REPLACE FUNCTION after_post_insert_notify_subscriptions()
  returns trigger
  language plpgsql
  as $$
  DECLARE
    pid int;
    slug text;
    fid int;
    event_topic text;
  BEGIN
  select forum_id into fid from topics where id = NEW.topic_id;
  select project_id into pid from forums where id = fid;
  select projects.slug into slug from projects where id = pid;
  select concat('graphql:project:', slug, ':forumActivity') into event_topic;
  perform pg_notify(event_topic, json_build_object('postId', NEW.id, 'forumId', fid, 'projectId', pid, 'topicId', NEW.topic_id)::text);
  return NEW;
  END;
  $$;

CREATE TRIGGER post_after_insert_notify_subscriptions AFTER INSERT
ON posts
FOR EACH ROW
EXECUTE PROCEDURE after_post_insert_notify_subscriptions();
