--! Previous: sha1:7201b463211b69f17b86ec0bbf1984dea0783ead
--! Hash: sha1:8915f6c099122cd13255a8ad6bf2cc4860d0d1dd

-- Enter migration here
CREATE OR REPLACE FUNCTION public.topics_author_profile(topic public.topics) RETURNS public.user_profiles
    LANGUAGE sql STABLE
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
      user_profiles.user_id = topic.author_id
    limit 1;
  $$;
