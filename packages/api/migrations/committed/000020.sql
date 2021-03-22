--! Previous: sha1:a943cd0256bce79a4ebda91b2090a622755945a4
--! Hash: sha1:f0455b06949a61a4230b4fecbfb185107137160a

-- Enter migration here
alter table project_participants drop column if exists is_banned_from_forums;
alter table project_participants add column is_banned_from_forums boolean not null default false;

drop table if exists community_guidelines;
create table community_guidelines (
  project_id int primary key references projects (id),
  content jsonb not null default '{}'::jsonb
);

comment on table community_guidelines is '
@omit many,all
Community guidelines can be set by project admins with standards for using the 
discussion forums. Users will be shown this content before making their first
post, and they will be shown when posts are hidden by moderators for violating
community standards.
';

comment on column community_guidelines.content is '
JSON contents are expected to be used with a system like DraftJS on the client.
';

comment on constraint community_guidelines_project_id_fkey on community_guidelines is '
@foreignFieldName communityGuidelines
Community Guidelines for this project when using the discussion forums.
';

grant select on table community_guidelines to anon;
grant insert on table community_guidelines to seasketch_user;
grant delete on table community_guidelines to seasketch_user;
grant update (content) on table community_guidelines to seasketch_user;

alter table community_guidelines enable row level security;

create policy community_guidelines_admin on community_guidelines for all to seasketch_user using (
  session_is_admin(project_id)
) with check (
  session_is_admin(project_id)
);

create policy community_guidelines_select on community_guidelines for select to seasketch_user using (
  session_has_project_access(project_id)
);

alter table forums add column if not exists position int default 0;
alter table forums drop column if exists description;
alter table forums add column if not exists description text;
alter table forums add column if not exists archived boolean default false;
alter table forums drop column if exists locked;

comment on column forums.name is 'Title displayed for the forum.';
comment on column forums.description is 'Optional description of the forum to be displayed to project users.';
comment on column forums.position is 'Sets position of this forum in the listing. Forums should be listed by position in ascending order. Set using `setForumOrder()`';
comment on column forums.archived is 'Archived forums will only be accessible by project administrators from the admin dashboard. This is an alternative to deleting a forum.';

alter table access_control_lists drop column if exists forum_id cascade;
alter table access_control_lists add column if not exists forum_id_read int references forums (id) on delete cascade;
alter table access_control_lists add column if not exists forum_id_write int references forums (id) on delete cascade;

alter table access_control_lists drop constraint if exists
  access_control_list_has_related_model;
alter table access_control_lists add constraint 
  access_control_list_has_related_model check (
    (
        (sketch_class_id is not null)::integer +
        (forum_id_read is not null)::integer +
        (forum_id_write is not null)::integer
    ) = 1
  );

create unique index on access_control_lists (forum_id_read) 
  where forum_id_read is not null;

create unique index on access_control_lists (forum_id_write) 
  where forum_id_write is not null;

create or replace function create_forum_acl() returns trigger
    security definer
    language plpgsql
    AS $$
begin
  insert into
    access_control_lists(project_id, forum_id_read, type)
    values(new.project_id, new.id, 'public'::access_control_list_type);

  insert into
    access_control_lists(project_id, forum_id_write, type)
    values(new.project_id, new.id, 'public'::access_control_list_type);
  return new;
end;
$$;

drop policy if exists access_control_lists_update on access_control_lists;
CREATE POLICY access_control_lists_update ON public.access_control_lists FOR UPDATE TO seasketch_user USING (
  public.session_is_admin((
    SELECT 
      sketch_classes.project_id
    FROM 
      public.sketch_classes
    WHERE
      sketch_classes.id = access_control_lists.sketch_class_id
  )) OR public.session_is_admin(( 
    SELECT 
      forums.project_id
    FROM 
      public.forums
    WHERE
      forums.id = access_control_lists.forum_id_read or
      forums.id = access_control_lists.forum_id_write
    ))
  ) WITH CHECK (
    public.session_is_admin(( 
      SELECT 
        sketch_classes.project_id
      FROM 
        public.sketch_classes
      WHERE 
        sketch_classes.id = access_control_lists.sketch_class_id
    )) OR 
    public.session_is_admin(( 
      SELECT 
        forums.project_id
      FROM 
        public.forums
      WHERE 
        forums.id = access_control_lists.forum_id_read or
        forums.id = access_control_lists.forum_id_write
    ))
  );

drop policy if exists forums_select on forums;
create policy forums_select on forums for select using (
  session_has_project_access(project_id) and session_on_acl((select id from access_control_lists where forum_id_read = forums.id))
);

CREATE or replace FUNCTION set_forum_order("forumIds" integer[]) RETURNS SETOF public.forums
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      pos int;
      forum record;
    begin
      select 
        forums.project_id
      into
        pid
      from
        forums
      where
        forums.id = any ("forumIds")
      limit 1;
      if session_is_admin(pid) = false then
        raise exception 'Must be project admin';
      end if;
      pos = 1;
      for forum in (select * from forums where forums.project_id = pid order by array_position("forumIds", id)) loop
        update forums set position = pos where id = forum.id;
        pos = pos + 1;
      end loop;
      return query select * from forums where forums.project_id = pid order by position asc;
    end
  $$;

grant execute on function set_forum_order to seasketch_user;

comment on table forums is '
@omit all
Discussion forums are the highest level organizing unit of the discussion forums
for a project. Each forum can have many topics (threads), which then contain
posts. Only project administrators can create and configure forums.
';

revoke all on table forums from seasketch_user;
grant select on forums to anon;
grant update (name, position, archived, description) on forums to seasketch_user;
grant delete on forums to seasketch_user;
grant insert on forums to seasketch_user;


drop table if exists topics cascade;
create table topics (
  id int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  title text not null constraint titlechk CHECK (char_length(title) <= 80),
  forum_id integer NOT NULL REFERENCES forums (id) ON DELETE CASCADE,
  author_id integer NOT NULL REFERENCES users (id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  sticky boolean not null default false,
  locked boolean not null default false
);

comment on column topics.title is 'Title displayed in the topics listing. Can be updated in the first 5 minutes after creation.';
comment on column topics.sticky is 'Can be toggled by project admins. Sticky topics will be listed at the topic of the forum.';
comment on column topics.locked is 'Can be toggled by project admins. Locked topics can only be posted to by project admins and will display a lock symbol.';

create index on topics (forum_id);

revoke all on table topics from seasketch_user;
grant select on topics to anon;
grant update (title, sticky, locked) on topics to seasketch_user;
grant delete on topics to seasketch_user;

alter table topics enable row level security;

-- select policy
create policy topics_select on topics for select to seasketch_user using (
  session_has_project_access((select project_id from forums where id = forum_id)) and
  session_on_acl((
    select 
      id 
    from 
      access_control_lists 
    where 
      forum_id_read = forum_id
  ))
);

-- update and delete policy (5 min editing period, assuming no posts)
create policy topics_update on topics for update using (
  session_is_admin((select project_id from forums where id = forum_id)) or (
    it_me(author_id) and now() < created_at + interval '5 minutes'
  )
) with check (
  session_is_admin((select project_id from forums where id = forum_id)) or (
    it_me(author_id) and now() < created_at + interval '5 minutes'
  )
);


create or replace function topics_author_profile(topic topics)
  returns user_profiles
  language sql
  stable
  as $$
    select
      user_profiles.*
    from
      user_profiles
    inner join
      topics
    on
      topics.id = topic.id
    inner join
      project_participants
    on
      project_participants.user_id = topic.author_id
    where
      project_participants.share_profile = true
    limit 1;
  $$;

grant execute on function topics_author_profile to anon;
comment on function topics_author_profile is '
User Profile of the author. If a user has not shared their profile the first post contents will be hidden.
';

drop table if exists posts cascade;
create table posts (
  id int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  topic_id integer NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  author_id integer NOT NULL REFERENCES users (id),
  created_at timestamp with time zone not null DEFAULT timezone('utc'::text, now()) NOT NULL,
  message_contents jsonb not null default '{}'::jsonb,
  hidden_by_moderator boolean not null default false
);

create index on posts (topic_id);

grant select on posts to anon;
comment on column posts.message_contents is '@omit';
grant delete on posts to seasketch_user;

create policy topics_delete on topics for delete using (
  session_is_admin((select project_id from forums where id = forum_id)) or (
    it_me(author_id) and 
    now() < created_at + interval '5 minutes' and
    not exists(select 1 from posts where topic_id = id and posts.author_id != author_id)
  )
);

-- createTopic function
create or replace function create_topic("forumId" int, title text, message jsonb)
  returns topics
  language plpgsql
  security definer
  as $$
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
        insert into posts (topic_id, author_id, message_contents) values (topic.id, current_setting('session.user_id', TRUE)::int, message);
        return topic;
      end if;
    end;
  $$;

grant execute on function create_topic to seasketch_user;
comment on function create_topic is '
Must have write permission for the specified forum. Create a new discussion topic, including the first post. `message` must be JSON, something like the output of DraftJS.
';


create policy posts_select on posts for select to anon using(
  session_has_project_access((
    select
      project_id
    from
      forums
    inner join
      topics
    on
      topics.id = topic_id
    where
      forums.id = topics.forum_id
  )) and
  session_on_acl((
    select
      access_control_lists.id
    from
      access_control_lists
    inner join
      topics
    on
      topics.id = topic_id
    inner join
      forums
    on
      forums.id = topics.forum_id
    where
      access_control_lists.forum_id_read = forums.id
  ))
);

-- create policy posts_update on posts for update using (
--   (it_me(author_id) and now() < created_at + interval '5 minutes') or
--   session_is_admin((
--     select
--       forums.project_id
--     from
--       forums
--     inner join
--       topics
--     on
--       topics.id = topic_id
--     where
--       forums.id = topics.forum_id
--   ))
-- ) with check (
--   (it_me(author_id) and now() < created_at + interval '5 minutes') or
--   session_is_admin((
--     select
--       forums.project_id
--     from
--       forums
--     inner join
--       topics
--     on
--       topics.id = topic_id
--     where
--       forums.id = topics.forum_id
--   ))
-- );

create or replace function update_post("postId" int, message jsonb)
  returns posts
  security definer
  language plpgsql
  volatile
  as $$
    declare
      pid int;
      tid int;
      post posts;
    begin
      select
        topics.id,
        forums.project_id
      from
        posts
      into
        tid,
        pid
      inner join
        topics
      on
        posts.topic_id = topics.id
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        posts.id = "postId";

      if session_is_admin(pid) then
        update 
          posts 
        set 
          message_contents = message
        where
          id = "postId"
        returning
          *
        into
          post;
        return post;
      else
        if not exists(select 1 from posts where id = "postId" and author_id = current_setting('session.user_id', TRUE)::int) then
          raise exception 'Permission denied';
        end if;
        if not exists(select 1 from posts where id = "postId" and created_at > now() - interval '5 minutes') then
          raise exception 'Posts can only be edited in the first 5 minutes after posting.';
        end if;
        update 
          posts 
        set 
          message_contents = message
        where
          id = "postId"
        returning
          *
        into
          post;
        return post;
      end if;
    end;
  $$;

grant execute on function update_post to seasketch_user;

create or replace function set_post_hidden_by_moderator("postId" int, "value" boolean)
  returns posts
  language plpgsql
  security definer
  as $$
    declare
      pid int;
      post posts;
    begin
      select
        forums.project_id
      from
        posts
      into
        pid
      inner join
        topics
      on
        posts.topic_id = topics.id
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        posts.id = "postId";
      if session_is_admin(pid) = false then
        raise exception 'Permission denied';
      end if;
      update posts set hidden_by_moderator = "value" where id = "postId" returning * into post;
      return post;
    end;
  $$;

grant execute on function set_post_hidden_by_moderator to seasketch_user;

create policy posts_delete on posts for delete using (
  (it_me(author_id) and now() < created_at + interval '5 minutes') or
  session_is_admin((
    select
      forums.project_id
    from
      forums
    inner join
      topics
    on
      topics.id = topic_id
    where
      forums.id = topics.forum_id
  ))
);

create or replace function session_is_banned_from_posting(pid int)
  returns boolean
  security definer
  language sql
  stable
  as $$
    select is_banned_from_forums from project_participants where project_id = pid and user_id = nullif(current_setting('session.user_id', TRUE), '')::int;
  $$;

grant execute on function session_is_banned_from_posting to anon;

-- create_post function

create or replace function create_post(message jsonb, "topicId" int)
  returns posts
  language plpgsql
  security definer
  as $$
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
      insert into posts (message_contents, topic_id, author_id) values (message, "topicId", current_setting('session.user_id', TRUE)::int) returning * into post;
      return post;
    end;
  $$;

grant execute on function create_post to seasketch_user;
-- post.authorProfile

create or replace function posts_author_profile(post posts)
  returns user_profiles
  language sql
  stable
  as $$
    select
      user_profiles.*
    from
      user_profiles
    inner join
      project_participants
    on
      project_participants.user_id = post.author_id
    where
      project_participants.share_profile = true
    limit 1;
  $$;

grant execute on function posts_author_profile to anon;
comment on function posts_author_profile is '
User Profile of the author. If a user has not shared their profile the post message will be hidden.
';

-- post.message
create or replace function posts_message(post posts)
  returns jsonb
  security definer
  language sql
  stable
  as $$
    select
      message_contents
    from
      posts
    inner join
      topics
    on
      topics.id = post.topic_id
    inner join
      forums
    on
      forums.id = topics.forum_id
    inner join
      project_participants
    on
      project_participants.user_id = post.author_id
    where
      posts.id = post.id and
      post.hidden_by_moderator = false and
      project_participants.share_profile = true and
      project_participants.project_id = forums.project_id
  $$;

grant execute on function posts_message to anon;

comment on function posts_message is '
Message contents of the post as JSON for use with DraftJS. 

Message may be null if user is not currently sharing their profile, in which 
case the client should explain such. 

Message could also be null if `hiddenByModerator` is set. In that case the 
client should explain that the post violated the `CommunityGuidelines`, if set.
';

-- Notifications

drop table if exists pending_topic_notifications cascade;
create table pending_topic_notifications (
  id int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  topic_id int not null REFERENCES topics (id),
  user_id int not null references users (id),
  unique (topic_id, user_id)
);

comment on table pending_topic_notifications is '
Created by trigger whenever a new message is posted to a topic, for each user who has 
replied to that topic. A backend process will need to periodically check this 
table and delete records.
';

drop table if exists topic_notification_unsubscribes cascade;
create table topic_notification_unsubscribes (
  id int GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  topic_id int not null REFERENCES topics (id),
  user_id int not null references users (id),
  unique (topic_id, user_id)
);

comment on table topic_notification_unsubscribes is '
Users are emailed notifications when there is a response to discussion topics 
they have replied to. These could get annoying for very chatty threads, so users
have the option to unsubscribe to a single topic by clicking a link in their 
email. This link should include a jwt token that identifies the project, topic, 
and user.
';

create index on topic_notification_unsubscribes (topic_id, user_id);

create or replace function after_post_insert()
  returns trigger
  language plpgsql
  security definer
  as $$
    begin
      insert into pending_topic_notifications (
        user_id, 
        topic_id
      ) select distinct 
          posts.author_id, 
          NEW.topic_id
        from
          posts
        where
          posts.topic_id = NEW.topic_id and
          -- don't notify anyone who has unsubscribed from this topic
          posts.author_id not in (select user_id from topic_notification_unsubscribes where topic_id = NEW.topic_id) and
          -- don't notify self
          posts.author_id != NEW.author_id
      on conflict do nothing;
      return NEW;
    end;
  $$;

create trigger after_post_insert_trigger
  after insert on posts
  for each row execute procedure after_post_insert();

create or replace function mark_topic_as_read("topicId" int)
  returns boolean
  language sql
  volatile
  security definer
  as $$
    delete from pending_topic_notifications where it_me(user_id) and topic_id = "topicId" returning true;
  $$;

grant execute on function mark_topic_as_read to seasketch_user;

comment on function mark_topic_as_read is '
Mark the topic as read by the current session user. Used to avoid sending email
notifications to users who have already read a topic. Call when loading a topic, 
and whenever new posts are shown.
';

create or replace function set_topic_locked("topicId" int, value boolean)
  returns topics
  language plpgsql
  volatile
  security definer
  as $$
    declare
      pid int;
      topic topics;
    begin
      select
        forums.project_id
      from
        topics
      into
        pid
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        topics.id = "topicId";
      if session_is_admin(pid) then
        update topics set locked = value where id = "topicId" returning * into topic;
        return topic;
      end if;
      raise exception 'Must be project admin';
    end;
  $$;

grant execute on function set_topic_locked to seasketch_user;

comment on function set_topic_locked is 'Lock a topic so that it can no longer be responded to. Past discussion will still be visible. This mutation is only available to project admins.';

create or replace function projects_session_has_posts(project projects)
  returns boolean
  security definer
  language sql
  stable
  as $$
    select exists(
      select 
        1 
      from 
        posts 
      inner join
        topics
      on
        posts.topic_id = topics.id
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        forums.project_id = project.id and
        it_me(posts.author_id)
    );
  $$;

grant execute on function projects_session_has_posts to seasketch_user;

comment on function projects_session_has_posts is 'Whether the current user has any discussion forum posts in this project. Use this to determine whether `project.communityGuidelines` should be shown to the user before their first post.';

create or replace function set_topic_sticky("topicId" int, value boolean)
  returns topics
  language plpgsql
  volatile
  security definer
  as $$
    declare
      pid int;
      topic topics;
    begin
      select
        forums.project_id
      from
        topics
      into
        pid
      inner join
        forums
      on
        forums.id = topics.forum_id
      where
        topics.id = "topicId";
      if session_is_admin(pid) then
        update topics set sticky = value where id = "topicId" returning * into topic;
        return topic;
      end if;
      raise exception 'Must be project admin';
    end;
  $$;

grant execute on function set_topic_sticky to seasketch_user;

create or replace function enable_forum_posting("userId" int, "projectId" int)
  returns void
  security definer
  language plpgsql
  volatile
  as $$
    begin
      if session_is_admin("projectId") then
        update project_participants set is_banned_from_forums = false where project_id = "projectId" and user_id = "userId";
        return;
      else
        raise exception 'Must be project admin';
      end if;
    end;
  $$;
  
grant execute on function enable_forum_posting to seasketch_user;

comment on function enable_forum_posting is 'Re-enable discussion forum posting for a user that was previously banned.';

create or replace function disable_forum_posting("userId" int, "projectId" int)
  returns void
  security definer
  language plpgsql
  volatile
  as $$
    begin
      if session_is_admin("projectId") then
        update project_participants set is_banned_from_forums = true where project_id = "projectId" and user_id = "userId";
        return;
      else
        raise exception 'Must be project admin';
      end if;
    end;
  $$;
  
grant execute on function disable_forum_posting to seasketch_user;

comment on function disable_forum_posting is 'Ban a user from posting in the discussion forum';

create or replace function users_banned_from_forums(u users, "projectId" int)
  returns boolean
  security definer
  language plpgsql
  stable
  as $$
    declare
      is_banned boolean;
    begin
      if session_is_admin("projectId") then
        select is_banned_from_forums into is_banned from project_participants where project_id = "projectId" and user_id = u.id;
        return is_banned;
      else
        raise exception 'Must be a project admin';
      end if;
    end;
  $$;

grant execute on function users_banned_from_forums to seasketch_user;
comment on function users_banned_from_forums is 'Whether the user has been banned from the forums. Use `disableForumPosting()` and `enableForumPosting()` mutations to modify this state. Accessible only to admins.';

create or replace function projects_users_banned_from_forums(project projects)
  returns setof users
  security definer
  language plpgsql
  stable
  as $$
    begin
      if session_is_admin(project.id) then
        return query select users.* from users
        inner join
          project_participants
        on
          project_participants.user_id = users.id
        where
          project_participants.project_id = project.id and
          project_participants.is_banned_from_forums = true;
      else
        raise exception 'Must be a project admin';
      end if;
    end;
$$;

grant execute on function projects_users_banned_from_forums to seasketch_user;
comment on function projects_users_banned_from_forums is 'List of all banned users. Listing only accessible to admins.';
