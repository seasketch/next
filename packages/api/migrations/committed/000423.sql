--! Previous: sha1:9c686743cfb0e7339d0cbaea4cc76059af3793f4
--! Hash: sha1:bdd123a7a2d8ab05e0e058a5815968f6ed402bef

-- Enter migration here

-- undo
drop table if exists resolvable_layer_comment cascade;
drop function if exists public.table_of_contents_items_resolved_comment_threads(table_of_contents_items);
drop function if exists public.get_resolvable_layer_comment(int);
drop function if exists public.resolvable_layer_comments_replies(resolvable_layer_comments);
drop function if exists public.resolvable_layer_comments_resolved_by_profile(resolvable_layer_comments);
drop function if exists public.resolvable_layer_comments_author_profile(resolvable_layer_comments);
drop function if exists public.table_of_contents_items_resolved_comment_count(table_of_contents_items);
drop function if exists public.table_of_contents_items_has_unresolved_comment(table_of_contents_items);
drop function if exists public.table_of_contents_items_unresolved_comment(table_of_contents_items);
drop function if exists public.create_resolvable_layer_comment(int, int, jsonb, int);
drop function if exists public.resolve_resolvable_layer_comment(int);
drop function if exists public.reopen_resolvable_layer_comment(int);
drop index if exists resolvable_layer_comments_one_unresolved_root_per_toc_item;
drop index if exists resolvable_layer_comments_parent_idx;
drop index if exists resolvable_layer_comments_project_idx;
drop index if exists resolvable_layer_comments_toc_idx;
drop table if exists resolvable_layer_comments cascade;
drop function if exists public.trg_resolvable_layer_comment_changelog() cascade;
drop function if exists public.resolvable_layer_comments_enforce_draft_toc() cascade;

-- redo

do $$
begin
  if not exists (
    select 1 from pg_enum
    join pg_type on pg_enum.enumtypid = pg_type.oid
    where pg_type.typname = 'change_log_field_group'
      and pg_enum.enumlabel = 'resolvable_layer_comments:created'
  ) then
    alter type change_log_field_group add value 'resolvable_layer_comments:created';
  end if;
  if not exists (
    select 1 from pg_enum
    join pg_type on pg_enum.enumtypid = pg_type.oid
    where pg_type.typname = 'change_log_field_group'
      and pg_enum.enumlabel = 'resolvable_layer_comments:responded'
  ) then
    alter type change_log_field_group add value 'resolvable_layer_comments:responded';
  end if;
  if not exists (
    select 1 from pg_enum
    join pg_type on pg_enum.enumtypid = pg_type.oid
    where pg_type.typname = 'change_log_field_group'
      and pg_enum.enumlabel = 'resolvable_layer_comments:resolved'
  ) then
    alter type change_log_field_group add value 'resolvable_layer_comments:resolved';
  end if;
  if not exists (
    select 1 from pg_enum
    join pg_type on pg_enum.enumtypid = pg_type.oid
    where pg_type.typname = 'change_log_field_group'
      and pg_enum.enumlabel = 'resolvable_layer_comments:reopened'
  ) then
    alter type change_log_field_group add value 'resolvable_layer_comments:reopened';
  end if;
end
$$;

create or replace function changelog_row_net_zero_changes(
  p_field_group change_log_field_group,
  p_from_summary jsonb,
  p_to_summary jsonb,
  p_from_blob jsonb,
  p_to_blob jsonb
) returns boolean
language sql
immutable
parallel safe
as $$
  select case
    when p_field_group::text in (
      'resolvable_layer_comments:created',
      'resolvable_layer_comments:responded',
      'resolvable_layer_comments:resolved',
      'resolvable_layer_comments:reopened'
    ) then false
    when (p_from_blob is not null) or (p_to_blob is not null) then
      not (p_from_blob is distinct from p_to_blob)
    when p_field_group = 'layer:attribution'::change_log_field_group then
      not (
        changelog_normalize_layer_attribution_summary(p_from_summary)
        is distinct from
        changelog_normalize_layer_attribution_summary(p_to_summary)
      )
    else
      not (p_from_summary is distinct from p_to_summary)
  end;
$$;

create table if not exists resolvable_layer_comments(
  id int generated always as identity primary key,
  project_id int not null references projects(id) on delete cascade,
  table_of_contents_item_id int not null references table_of_contents_items(id) on delete cascade,
  comment jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id int not null references users(id) on delete cascade,
  resolved_at timestamptz,
  resolved_by_id int references users(id) on delete set null,
  parent_comment_id int references resolvable_layer_comments(id) on delete cascade
);

create index if not exists resolvable_layer_comments_toc_idx
  on resolvable_layer_comments(table_of_contents_item_id);
create index if not exists resolvable_layer_comments_project_idx
  on resolvable_layer_comments(project_id);
create index if not exists resolvable_layer_comments_parent_idx
  on resolvable_layer_comments(parent_comment_id);

-- At most one open (unresolved) root thread per layer; replies use parent_comment_id and are excluded.
create unique index if not exists resolvable_layer_comments_one_unresolved_root_per_toc_item
  on resolvable_layer_comments (table_of_contents_item_id)
  where resolved_at is null
    and parent_comment_id is null;

create or replace function public.resolvable_layer_comments_enforce_draft_toc()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.table_of_contents_items t
    where t.id = new.table_of_contents_item_id
      and t.is_draft = true
  ) then
    raise exception
      'Resolvable layer comments may only reference draft table_of_contents_items rows';
  end if;
  return new;
end;
$$;

create trigger before_insert_or_update_resolvable_layer_comments_enforce_draft_toc
  before insert or update of table_of_contents_item_id on public.resolvable_layer_comments
  for each row
  execute function public.resolvable_layer_comments_enforce_draft_toc();

create or replace function public.trg_resolvable_layer_comment_changelog()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_editor int;
  v_field_group text;
  v_change_log_id bigint;
begin
  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.parent_comment_id is null then
      v_field_group := 'resolvable_layer_comments:created';
    else
      v_field_group := 'resolvable_layer_comments:responded';
    end if;

    select record_changelog(
      new.project_id,
      v_editor,
      'table_of_contents_items',
      new.table_of_contents_item_id,
      v_field_group::change_log_field_group,
      '{}'::jsonb,
      '{}'::jsonb,
      null,
      null,
      jsonb_build_object(
        'comment_id', new.id,
        'parent_comment_id', new.parent_comment_id
      )
    ) into v_change_log_id;
    update change_logs set status = 'closed' where id = v_change_log_id;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.resolved_at is null and new.resolved_at is not null then
      v_field_group := 'resolvable_layer_comments:resolved';
    elsif old.resolved_at is not null and new.resolved_at is null then
      v_field_group := 'resolvable_layer_comments:reopened';
    else
      return new;
    end if;

    select record_changelog(
      new.project_id,
      v_editor,
      'table_of_contents_items',
      new.table_of_contents_item_id,
      v_field_group::change_log_field_group,
      '{}'::jsonb,
      '{}'::jsonb,
      null,
      null,
      jsonb_build_object('comment_id', new.id)
    ) into v_change_log_id;
    update change_logs set status = 'closed' where id = v_change_log_id;
    return new;
  end if;

  return null;
end;
$$;

create trigger changelog_resolvable_layer_comments
  after insert or update of resolved_at on public.resolvable_layer_comments
  for each row
  execute function public.trg_resolvable_layer_comment_changelog();

drop function if exists table_of_contents_items_resolvable_comments(item table_of_contents_items);

create or replace function table_of_contents_items_unresolved_comment(item table_of_contents_items)
  returns resolvable_layer_comments
  language sql
  security definer
  stable
  as $$
    select * from resolvable_layer_comments
      where table_of_contents_item_id = item.id
        and resolved_at is null
        and parent_comment_id is null
      order by created_at desc
      limit 1;
$$;

grant execute on function table_of_contents_items_unresolved_comment(item table_of_contents_items) to seasketch_user;

create or replace function table_of_contents_items_has_unresolved_comment(item table_of_contents_items)
  returns boolean
  language sql
  security definer
  stable
  as $$
    select exists (
      select 1
      from resolvable_layer_comments
      where table_of_contents_item_id = item.id
        and resolved_at is null
        and parent_comment_id is null
    );
$$;

grant execute on function table_of_contents_items_has_unresolved_comment(item table_of_contents_items) to seasketch_user;

create or replace function table_of_contents_items_resolved_comment_count(item table_of_contents_items)
  returns int
  language sql
  security definer
  stable
  as $$
    select count(*) from resolvable_layer_comments where table_of_contents_item_id = item.id and resolved_at is not null and parent_comment_id is null;
$$;

grant execute on function table_of_contents_items_resolved_comment_count(item table_of_contents_items) to seasketch_user;

create or replace function resolvable_layer_comments_author_profile(comment resolvable_layer_comments)
  returns user_profiles
  language sql
  security definer
  stable
  as $$
    select * from user_profiles where user_id = comment.author_id;
$$;

grant execute on function resolvable_layer_comments_author_profile(comment resolvable_layer_comments) to seasketch_user;

create or replace function resolvable_layer_comments_resolved_by_profile(comment resolvable_layer_comments)
  returns user_profiles
  language sql
  security definer
  stable
  as $$
    select * from user_profiles where user_id = comment.resolved_by_id;
$$;

grant execute on function resolvable_layer_comments_resolved_by_profile(comment resolvable_layer_comments) to seasketch_user;

create or replace function resolvable_layer_comments_replies(comment resolvable_layer_comments)
  returns setof resolvable_layer_comments
  language sql
  security definer
  stable
  as $$
    select * from resolvable_layer_comments where parent_comment_id = comment.id order by created_at asc;
$$;

grant execute on function resolvable_layer_comments_replies(comment resolvable_layer_comments) to seasketch_user;

comment on function resolvable_layer_comments_replies(comment resolvable_layer_comments) is '@simpleCollections only';

create or replace function table_of_contents_items_resolved_comment_threads(item table_of_contents_items)
  returns setof resolvable_layer_comments
  language sql
  security definer
  stable
  as $$
    select * from resolvable_layer_comments where table_of_contents_item_id = item.id and resolved_at is not null and parent_comment_id is null order by created_at desc;
$$;

grant execute on function table_of_contents_items_resolved_comment_threads(item table_of_contents_items) to seasketch_user;

comment on function table_of_contents_items_resolved_comment_threads(item table_of_contents_items) is '@simpleCollections only';

create or replace function get_resolvable_layer_comment(comment_id int)
  returns resolvable_layer_comments
  language sql
  security definer
  stable
  as $$
    select c.*
    from resolvable_layer_comments c
    where c.id = get_resolvable_layer_comment.comment_id
      and session_is_admin(c.project_id);
$$;

grant execute on function get_resolvable_layer_comment to seasketch_user;

drop function if exists create_resolvable_layer_comment;

create or replace function create_resolvable_layer_comment(project_id int, table_of_contents_item_id int, comment jsonb, parent_comment_id int, set_resolved boolean)
  returns resolvable_layer_comments
  language plpgsql
  security definer
  as $$
  declare
    new_comment resolvable_layer_comments;
  begin
    if session_is_admin(create_resolvable_layer_comment.project_id) = false then
      raise exception 'Access denied to project %', create_resolvable_layer_comment.project_id;
    end if;
    if set_resolved and parent_comment_id is null then
      raise exception 'Resolved comments must be replies to other comments';
    end if;
    if not exists (
      select 1
      from public.table_of_contents_items t
      where t.id = create_resolvable_layer_comment.table_of_contents_item_id
        and t.is_draft = true
    ) then
      raise exception 'Resolvable layer comments may only reference draft layers';
    end if;
    if set_resolved then
      update resolvable_layer_comments
        set resolved_at = now(), resolved_by_id = current_setting('session.user_id', true)::int
        where id = create_resolvable_layer_comment.parent_comment_id;
    end if;
    insert into resolvable_layer_comments (project_id, table_of_contents_item_id, comment, parent_comment_id, author_id)
      values (
        create_resolvable_layer_comment.project_id,
        create_resolvable_layer_comment.table_of_contents_item_id,
        create_resolvable_layer_comment.comment,
        create_resolvable_layer_comment.parent_comment_id,
        current_setting('session.user_id', true)::int
      )
      returning * into new_comment;
    return new_comment;
  end;
$$;

grant execute on function create_resolvable_layer_comment to seasketch_user;

create or replace function resolve_resolvable_layer_comment(comment_id int)
  returns resolvable_layer_comments
  language plpgsql
  security definer
  as $$
  declare
    updated_comment resolvable_layer_comments;
    comment_project_id int;
  begin
    select project_id into comment_project_id
      from resolvable_layer_comments
      where id = resolve_resolvable_layer_comment.comment_id;
    if session_is_admin(comment_project_id) = false then
      raise exception 'Access denied to project %', comment_project_id;
    end if;
    update resolvable_layer_comments
      set resolved_at = now(), resolved_by_id = current_setting('session.user_id', true)::int
      where id = resolve_resolvable_layer_comment.comment_id
      returning * into updated_comment;
    return updated_comment;
  end;
$$;

grant execute on function resolve_resolvable_layer_comment to seasketch_user;

create or replace function reopen_resolvable_layer_comment(comment_id int)
  returns resolvable_layer_comments
  language plpgsql
  security definer
  as $$
  declare
    updated_comment resolvable_layer_comments;
    comment_project_id int;
  begin
    select project_id into comment_project_id
      from resolvable_layer_comments
      where id = reopen_resolvable_layer_comment.comment_id;
    if session_is_admin(comment_project_id) = false then
      raise exception 'Access denied to project %', comment_project_id;
    end if;
    update resolvable_layer_comments
      set resolved_at = null, resolved_by_id = null
      where id = reopen_resolvable_layer_comment.comment_id
      returning * into updated_comment;
    return updated_comment;
  end;
$$;

grant execute on function reopen_resolvable_layer_comment to seasketch_user;

create or replace function resolvable_layer_comments_parent_comment(comment resolvable_layer_comments)
  returns resolvable_layer_comments
  language sql
  security definer
  stable
  as $$
    select * from resolvable_layer_comments where id = comment.parent_comment_id;
$$;

grant execute on function resolvable_layer_comments_parent_comment to seasketch_user;

grant execute on function get_latest_published_report_for_draft to anon;
grant execute on function get_primary_draft_report_id_for_sketch_class to anon;

drop function if exists projets_comments_since_last_publish(project projects);

create or replace function projects_comments_since_last_publish(project projects)
  returns setof resolvable_layer_comments
  language plpgsql
  security definer
  stable
  as $$
  declare
    v_last_publish timestamp;
  begin
    if session_is_admin(project.id) = false then
      raise exception 'Access denied to project %', project.id;
    end if;
    select table_of_contents_last_published into v_last_publish from projects where id = project.id;
    return query
    select * from resolvable_layer_comments where project_id = project.id and (resolved_at > v_last_publish or created_at > v_last_publish) and parent_comment_id is null;
  end;
$$;

grant execute on function projects_comments_since_last_publish(project projects) to seasketch_user;

comment on function projects_comments_since_last_publish(project projects) is '@simpleCollections only';
