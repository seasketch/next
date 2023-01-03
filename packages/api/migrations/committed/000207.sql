--! Previous: sha1:40ccd2702d9e56cbd75cba6b10c0f0980c014dd8
--! Hash: sha1:7201b463211b69f17b86ec0bbf1984dea0783ead

-- Enter migration here
create or replace function topics_last_post_date(topic topics)
  returns timestamp with time zone
  stable
  language sql
  as $$
    select created_at from posts where topic_id = topic.id order by created_at desc limit 1;
  $$;

grant execute on function topics_last_post_date to anon;

create or replace function topics_participants(topic topics)
  returns setof users
  language sql
  stable
  as $$
    with user_ids as (
      select author_id from posts where topic_id = topic.id order by created_at asc
    )
    select
      distinct(users.*)
    from
      user_ids
    inner join
      users
    on
      users.id = user_ids.author_id;
  $$;

grant execute on function topics_participants to anon;

create or replace function topics_last_author(topic topics)
  returns users
  language sql
  stable
  as $$
    select * from users where id = (select author_id from posts where topic_id = topic.id order by created_at desc limit 1);
  $$;

grant execute on function topics_last_author to anon;

drop function if exists topics_most_recent_blurb;

create or replace function topics_blurb(topic topics) 
  returns text
  language sql
  stable
  as $$
    select collect_text_from_prosemirror_body(posts.message_contents) from posts where id = (select id from posts where topic_id = topic.id order by created_at asc limit 1);
  $$;

grant execute on function topics_blurb to anon;
