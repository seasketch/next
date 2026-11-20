--! Previous: sha1:e2ff27113fbfcba5a11d490c52bc27e724d9e8e5
--! Hash: sha1:4ca95b211ea587deb1cd53962c645a50b4b62e89
--! Message: public page link previews for projects and forums

-- Public link-preview text for a project, forum list, forum, topic, or post.
-- Crawlers request the page without a session. Names and post text are
-- returned only when the project is public and, for a forum, when that
-- forum's read list is public. Anything else returns null so the page
-- keeps the generic SeaSketch title.

create or replace function public.page_link_preview(
  slug text,
  kind text,
  "forumId" integer default null,
  "topicId" integer default null,
  "postId" integer default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_forum_id integer := "forumId";
  v_topic_id integer := "topicId";
  v_post_id integer := "postId";
  v_project public.projects;
  v_forum public.forums;
  v_topic public.topics;
  v_post public.posts;
  v_title text;
  v_description text;
  v_image text;
  v_excerpt text;
begin
  select projects.* into v_project
  from projects
  where projects.slug = page_link_preview.slug
    and projects.is_deleted is not true
    and projects.access_control = 'public';

  if not found then
    return null;
  end if;

  v_title := nullif(trim(v_project.name), '');
  if v_title is null then
    return null;
  end if;

  if v_project.logo_url ~* '^https?://[^[:space:]<>"'']+$' then
    v_image := v_project.logo_url;
  end if;

  if kind = 'project' then
    v_description := nullif(trim(v_project.description), '');
    if v_description is null then
      v_description := 'A SeaSketch project.';
    end if;
  elsif v_project.hide_forums is true then
    return null;
  elsif kind = 'forums' then
    v_description := 'Discussion forums for ' || v_title || '.';
  elsif kind in ('forum', 'topic', 'post') then
    if v_forum_id is null then
      return null;
    end if;

    select forums.* into v_forum
    from forums
    where forums.id = v_forum_id
      and forums.project_id = v_project.id
      and forums.archived is not true
      and exists (
        select 1
        from access_control_lists
        where access_control_lists.forum_id_read = forums.id
          and access_control_lists.type = 'public'
      );

    if not found then
      return null;
    end if;

    if kind = 'forum' then
      v_title := coalesce(nullif(trim(v_forum.name), ''), 'Forum');
      v_description := nullif(trim(v_forum.description), '');
      if v_description is null then
        v_description := 'A forum in ' || v_project.name || '.';
      end if;
    else
      if v_topic_id is null then
        return null;
      end if;

      select topics.* into v_topic
      from topics
      where topics.id = v_topic_id
        and topics.forum_id = v_forum.id;

      if not found then
        return null;
      end if;

      v_title := nullif(trim(v_topic.title), '');
      if v_title is null then
        return null;
      end if;

      v_excerpt := null;
      if kind = 'post' and v_post_id is not null then
        select posts.* into v_post
        from posts
        where posts.id = v_post_id
          and posts.topic_id = v_topic.id
          and posts.hidden_by_moderator is not true;
        if found then
          v_excerpt := nullif(
            trim(collect_text_from_prosemirror_body(v_post.message_contents, 240)),
            ''
          );
        end if;
      end if;

      if v_excerpt is null then
        v_description := 'In ' || coalesce(nullif(trim(v_forum.name), ''), 'this forum')
          || ' on ' || v_project.name || '.';
      else
        v_description := v_excerpt;
      end if;
    end if;
  else
    return null;
  end if;

  v_title := trim(regexp_replace(v_title, '[[:space:]]+', ' ', 'g'));
  v_description := trim(regexp_replace(v_description, '[[:space:]]+', ' ', 'g'));
  if v_title is null or v_title = '' or v_description is null or v_description = '' then
    return null;
  end if;
  if length(v_description) > 240 then
    v_description := left(v_description, 239) || '…';
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'title', v_title,
    'description', v_description,
    'imageUrl', v_image
  ));
end;
$$;

comment on function public.page_link_preview(text, text, integer, integer, integer) is
  'Title, description, and logo for a public project, forum, topic, or post link. Private projects and forums are omitted.';

revoke all on function public.page_link_preview(text, text, integer, integer, integer) from public;
grant execute on function public.page_link_preview(text, text, integer, integer, integer) to anon;
grant execute on function public.page_link_preview(text, text, integer, integer, integer) to seasketch_user;
