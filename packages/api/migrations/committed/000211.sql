--! Previous: sha1:387d48889ee50111e8902accebb1d3a9296831af
--! Hash: sha1:48baa56175faa7462356b7baf896a6d311381956

-- Enter migration here
alter table posts add column if not exists html text not null;

DROP function if exists create_topic;
CREATE OR REPLACE FUNCTION public.create_topic("forumId" integer, title text, message jsonb, html text) RETURNS public.topics
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      topic topics;
      pid int;
    begin
      select project_id into pid from forums where id = "forumId";
      if session_has_project_access(pid) = false then
        raise exception 'Project access permission denied';
      end if;
      if not exists(select 1 from project_participants where it_me(user_id) and project_id = pid and share_profile = true) then
        raise exception 'User profile must be shared in order to post in the forum';
      end if;
      if session_is_banned_from_posting(pid) then
        raise exception 'Forum posts have been disabled for this user';
      end if;
      if session_on_acl((select id from access_control_lists where forum_id_write = "forumId")) = false then
        raise exception 'Permission denied';
      elsif exists(select 1 from forums where id = "forumId" and archived = true) then
        raise exception 'Cannot post to archived forums';
      else
        insert into topics (title, forum_id, author_id) values (title, "forumId", current_setting('session.user_id', TRUE)::int) returning * into topic;
        insert into posts (topic_id, author_id, message_contents, html) values (topic.id, current_setting('session.user_id', TRUE)::int, message, create_topic.html);
        return topic;
      end if;
    end;
  $$;

DROP function if exists create_post;
CREATE FUNCTION public.create_post(message jsonb, "topicId" integer, html text) RETURNS public.posts
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      post posts;
      pid int;
      is_archived boolean;
      locked boolean;
      is_admin boolean;
    begin
      select
        project_id,
        archived,
        topics.locked,
        session_is_admin(project_id)
      from
        forums
      into
        pid,
        is_archived,
        locked,
        is_admin
      inner join
        topics
      on
        topics.id = "topicId"
      where
        forums.id = topics.forum_id;
      if session_has_project_access(pid) = false then
        raise exception 'Project access permission denied';
      end if;
      if session_on_acl((select id from access_control_lists where forum_id_write = (select forum_id from topics where id = "topicId"))) = false then
        raise exception 'Permission denied';
      end if;
      if not exists(select 1 from project_participants where it_me(user_id) and project_id = pid and share_profile = true) then
        raise exception 'User profile must be shared in order to post in the forum';
      end if;
      if session_is_banned_from_posting(pid) then
        raise exception 'Forum posts have been disabled for this user';
      end if;
      if is_admin = false and locked = true then
        raise exception 'Cannot post to a locked topic';
      end if;
      if is_admin = false and is_archived = true then
        raise exception 'Cannot post to archived forums';
      end if;
      insert into posts (message_contents, topic_id, author_id, html) values (message, "topicId", current_setting('session.user_id', TRUE)::int, create_post.html) returning * into post;
      return post;
    end;
  $$;

grant execute on function create_post to seasketch_user;
grant execute on function create_topic to seasketch_user;

comment on function create_post is '@omit';
comment on function create_topic is '@omit';
