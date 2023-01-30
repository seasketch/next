--! Previous: sha1:35c99796dc079146bf916f8f41451a031ede5e21
--! Hash: sha1:57ccffc859fd53e1be83dad0f1d7c548d0d63987

-- Enter migration here
CREATE OR REPLACE FUNCTION public.collect_text_from_prosemirror_body(body jsonb, max_length int) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      output text;
      i jsonb;
    begin
      output = '';
      if body ? 'text' then
        output = concat(output, body->>'text');
      end if;
      if body ? 'content' then
        for i in (select * from jsonb_array_elements((body->'content')))
        loop
          if length(output) > max_length then
            return output || '...';
          else
            output = concat(output, collect_text_from_prosemirror_body(i, max_length));
          end if;
        end loop;
      end if;
      return output;
    end;
  $$;

grant execute on function collect_text_from_prosemirror_body(jsonb, int) to anon;

CREATE OR REPLACE FUNCTION public.posts_blurb(post public.posts) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    select collect_text_from_prosemirror_body(post.message_contents, 52);
  $$;

CREATE OR REPLACE FUNCTION public.topics_blurb(topic public.topics) RETURNS text
    LANGUAGE sql STABLE
    AS $$
    select collect_text_from_prosemirror_body(posts.message_contents, 52) from posts where id = (select id from posts where topic_id = topic.id order by created_at asc limit 1);
  $$;
