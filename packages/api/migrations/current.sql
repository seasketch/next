-- Enter migration here

-- undo
drop table if exists resolvable_layer_comment cascade;
drop function if exists public.table_of_contents_items_resolved_comment_threads(table_of_contents_items);
drop function if exists public.resolvable_layer_comments_replies(resolvable_layer_comments);
drop function if exists public.resolvable_layer_comments_resolved_by_profile(resolvable_layer_comments);
drop function if exists public.resolvable_layer_comments_author_profile(resolvable_layer_comments);
drop function if exists public.table_of_contents_items_resolved_comment_count(table_of_contents_items);
drop function if exists public.table_of_contents_items_unresolved_comment(table_of_contents_items);
drop function if exists public.create_resolvable_layer_comment(int, int, jsonb, int);
drop function if exists public.resolve_resolvable_layer_comment(int);
drop function if exists public.reopen_resolvable_layer_comment(int);
drop index if exists resolvable_layer_comments_one_unresolved_root_per_toc_item;
drop index if exists resolvable_layer_comments_parent_idx;
drop index if exists resolvable_layer_comments_project_idx;
drop index if exists resolvable_layer_comments_toc_idx;
drop table if exists resolvable_layer_comments cascade;
drop function if exists public.resolvable_layer_comments_enforce_draft_toc() cascade;

-- redo

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

create or replace function create_resolvable_layer_comment(project_id int, table_of_contents_item_id int, comment jsonb, parent_comment_id int)
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
    if not exists (
      select 1
      from public.table_of_contents_items t
      where t.id = create_resolvable_layer_comment.table_of_contents_item_id
        and t.is_draft = true
    ) then
      raise exception 'Resolvable layer comments may only reference draft layers';
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