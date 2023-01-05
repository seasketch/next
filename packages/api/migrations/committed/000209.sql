--! Previous: sha1:8915f6c099122cd13255a8ad6bf2cc4860d0d1dd
--! Hash: sha1:198df168d6c24567e6810e85744b193988acd68e

-- Enter migration here
CREATE OR REPLACE FUNCTION public.posts_author_profile(post public.posts) RETURNS public.user_profiles
    LANGUAGE sql STABLE
    security definer
    AS $$
    select
      user_profiles.*
    from
      user_profiles
    inner join
      project_participants
    on
      project_participants.user_id = post.author_id
    where
      project_participants.share_profile = true and
      project_participants.project_id = (select project_id from forums where forums.id = ((select forum_id from topics where topics.id = post.topic_id))) and
      user_profiles.user_id = post.author_id
    limit 1;
  $$;

CREATE OR REPLACE FUNCTION public.topics_author_profile(topic public.topics) RETURNS public.user_profiles
    LANGUAGE sql STABLE
    security definer
    AS $$
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
      project_participants.share_profile = true and
      project_participants.project_id = (select project_id from forums where forums.id = ((select forum_id from topics where topics.id = topic.id))) and
      user_profiles.user_id = topic.author_id
    limit 1;
  $$;


CREATE or replace FUNCTION public.topics_author_profile(topic public.topics) RETURNS public.user_profiles
    LANGUAGE sql STABLE
    security definer
    AS $$
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
      project_participants.share_profile = true and
      project_participants.project_id = (select project_id from forums where forums.id = ((select forum_id from topics where topics.id = topic.id))) and
      user_profiles.user_id = topic.author_id
    limit 1;
  $$;

drop function if exists topics_last_author;

-- CREATE FUNCTION public.topics_last_author(topic public.topics) RETURNS public.users
--     LANGUAGE sql STABLE
--     security definer
--     AS $$
--     select * from users where id = (select author_id from posts where topic_id = topic.id order by created_at desc limit 1);
--   $$;
DROP FUNCTION IF EXISTS topics_participants;
CREATE OR REPLACE FUNCTION public.topics_participants(topic public.topics) RETURNS SETOF public.user_profiles
    LANGUAGE sql STABLE
    security definer
    AS $$
    with user_ids as (
      select author_id from posts where topic_id = topic.id order by created_at asc
    )
    select
      distinct(user_profiles.*)
    from
      user_profiles
    inner join
      project_participants
    on
      project_participants.user_id = user_profiles.user_id
    where 
      user_profiles.user_id in (select author_id from user_ids) and
      project_participants.project_id = (select project_id from forums where forums.id = ((select forum_id from topics where topics.id = topic.id))) and
      project_participants.share_profile = true;
  $$;

grant execute on function topics_participants to anon;

DROP POLICY if exists topics_select on topics;
CREATE POLICY topics_select ON public.topics FOR SELECT TO anon USING ((public.session_has_project_access(( SELECT forums.project_id
   FROM public.forums
  WHERE (forums.id = topics.forum_id))) AND public.session_on_acl(( SELECT access_control_lists.id
   FROM public.access_control_lists
  WHERE (access_control_lists.forum_id_read = topics.forum_id)))));
