--! AllowInvalidHash
--! Previous: sha1:2f31ea7bdf3d10fb4b3c515ae468ff653d8598ba
--! Hash: sha1:563ade500e1b50ea065d38bbdd96df4a4b50f173

-- Enter migration here
create or replace function forums_topic_count(forum forums)
  returns int
  language sql
  stable
  as $$
    select count(*)::int from topics where forum_id = forum.id;
  $$;

grant execute on function forums_topic_count to anon;

create or replace function forums_post_count(forum forums)
  returns int
  language sql
  stable
  as $$
    select count(*)::int from posts where topic_id in ((select id from topics where forum_id = forum.id));
  $$;

grant execute on function forums_post_count to anon;

create or replace function forums_last_post_date(forum forums)
  returns timestamp with time zone
  language sql
  stable
  as $$
    select 
      created_at 
    from 
      posts 
    where topic_id in (select id from topics where forum_id = forum.id)
    order by posts.created_at desc
    limit 1;
  $$;

grant execute on function forums_last_post_date to anon;

create or replace function forums_read_acl(forum forums)
  returns access_control_lists
  stable
  language sql
  as $$
    select * from access_control_lists where access_control_lists.forum_id_read = forum.id;
  $$;

create or replace function forums_write_acl(forum forums)
  returns access_control_lists
  stable
  language sql
  as $$
    select * from access_control_lists where access_control_lists.forum_id_write = forum.id;
  $$;

grant execute on function forums_read_acl to seasketch_user;
grant execute on function forums_write_acl to seasketch_user;

create or replace function projects_latest_posts(project projects)
  returns setof posts
  language sql
  stable
  as $$
    select * from posts where topic_id in ((select id from topics where forum_id in ((select id from forums where project_id = project.id)))) order by created_at desc;
  $$;

grant execute on function projects_latest_posts to anon;

create or replace function topics_posts_count(topic topics)
  returns int
  language sql
  stable
  as $$
    select count(*)::int from posts where topic_id = topic.id;
  $$;

grant execute on function topics_posts_count to anon;


CREATE OR REPLACE FUNCTION forums_can_post(forum forums) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    with acl as (
      select id, type, project_id from access_control_lists where forum_id_write = forum.id
    )
    select 
      (
        exists(select 1 from acl where type = 'public') or 
        (
          exists(select 1 from acl where type = 'group') and 
          current_setting('session.user_id', TRUE) != '' and 
          exists (
            select 1 from access_control_list_groups 
              where access_control_list_id = (select id from acl) and group_id in (
                select group_id from project_group_members where user_id = nullif(current_setting('session.user_id', TRUE), '')::integer
              )
          )
        )
      ) or session_is_admin((select project_id from acl))
  $$;

grant execute on function forums_can_post to anon;
