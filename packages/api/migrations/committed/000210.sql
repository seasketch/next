--! Previous: sha1:198df168d6c24567e6810e85744b193988acd68e
--! Hash: sha1:387d48889ee50111e8902accebb1d3a9296831af

-- Enter migration here
create or replace function topics_participant_count(topic topics)
  returns int
  language sql
  security definer
  stable
  as $$
    select count(*) from ((select distinct(author_id) from posts where topic_id = topic.id)) as foo;
  $$;

grant execute on function topics_participant_count to anon;


CREATE OR REPLACE FUNCTION public.posts_blurb(post public.posts) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    select collect_text_from_prosemirror_body(post.message_contents);
  $$;

grant execute on function posts_blurb to anon;
