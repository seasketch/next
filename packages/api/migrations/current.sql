-- =============================================================================
-- WIP parking migration: the rollback block restores a dev DB that already
-- applied the feature below. The forward migration is commented out so a clean
-- checkout matches baseline schema and generated GraphQL. Uncomment forward
-- when resuming this branch.
--
-- PostgreSQL cannot remove enum labels from change_log_field_group without
-- recreating the type; extra labels are harmless when unused.
-- =============================================================================

-- --- Rollback to baseline (matches packages/api/schema.sql on master) ---

drop table if exists resolvable_layer_comment cascade;

-- Trigger helpers may survive table drop if not tied to the row type.
drop function if exists public.touch_resolvable_layer_comment_updated_at() cascade;
drop function if exists public.enforce_resolvable_layer_comment_draft_toc() cascade;

-- Original changelog function
CREATE OR REPLACE FUNCTION public.record_changelog(p_project_id integer, p_editor_id integer, p_entity_type text, p_entity_id integer, p_field_group public.change_log_field_group, p_from_summary jsonb, p_to_summary jsonb, p_from_blob jsonb DEFAULT NULL::jsonb, p_to_blob jsonb DEFAULT NULL::jsonb, p_meta jsonb DEFAULT NULL::jsonb) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
declare
  v_now          timestamptz := clock_timestamp();
  v_window       interval;
  v_existing_id  bigint;
  v_existing_last timestamptz;
begin
  -- Choose your coalescing window per field_group.
  -- These only need to be changed for settings which users might really 
  -- deliberate on, such as cartography, or changes that should be immediately
  -- recorded (e.g. layer:deleted).
  v_window :=
    case p_field_group
      when 'layer:metadata'::change_log_field_group then interval '10 seconds'
      when 'layer:cartography'::change_log_field_group then interval '5 minutes'
      when 'layer:interactivity'::change_log_field_group then interval '2 minutes'
      when 'layers:published'::change_log_field_group then interval '5 seconds'
      when 'layers:z-order-change'::change_log_field_group then interval '5 minutes'
      when 'layer:uploaded'::change_log_field_group then interval '0 seconds'
      when 'layer:downloadable'::change_log_field_group then interval '10 seconds'
      when 'layer:deleted'::change_log_field_group then interval '0 seconds'
      when 'folder:deleted'::change_log_field_group then interval '0 seconds'
      else interval '1 minute'
    end;

  /*
    Find the current open row for this key (if any) and lock it.
    Because of the partial unique index, there can be at most one open row.
  */
  select id, last_at
    into v_existing_id, v_existing_last
  from change_logs
  where project_id = p_project_id
    and editor_id = p_editor_id
    and entity_type = p_entity_type
    and entity_id = p_entity_id
    and field_group = p_field_group
    and status = 'open'
  limit 1
  for update;

  if v_existing_id is not null then
    -- Decide whether to merge into the existing open row, or close+start a new one.
    if (v_now - v_existing_last) <= v_window then
      -- Merge: preserve from_* and meta; update to_* and counters.
      update change_logs
      set
        last_at    = v_now,
        save_count = save_count + 1,
        to_summary = coalesce(p_to_summary, to_summary),
        to_blob    = case
                       when p_to_blob is null then to_blob
                       else p_to_blob
                     end
      where id = v_existing_id;

      return v_existing_id;
    else
      -- Outside the window: close the old row and create a new open row.
      update change_logs
      set status = 'closed'
      where id = v_existing_id;

      insert into change_logs (
        project_id, editor_id,
        started_at, last_at,
        status, save_count,
        from_summary, to_summary,
        from_blob, to_blob,
        entity_type, entity_id,
        field_group, meta
      ) values (
        p_project_id, p_editor_id,
        v_now, v_now,
        'open', 1,
        coalesce(p_from_summary, '{}'::jsonb),
        coalesce(p_to_summary, '{}'::jsonb),
        p_from_blob,
        p_to_blob,
        p_entity_type, p_entity_id,
        p_field_group,
        p_meta
      )
      returning id into v_existing_id;

      return v_existing_id;
    end if;
  else
    -- No open row exists: create one.
    insert into change_logs (
      project_id, editor_id,
      started_at, last_at,
      status, save_count,
      from_summary, to_summary,
      from_blob, to_blob,
      entity_type, entity_id,
      field_group, meta
    ) values (
      p_project_id, p_editor_id,
      v_now, v_now,
      'open', 1,
      coalesce(p_from_summary, '{}'::jsonb),
      coalesce(p_to_summary, '{}'::jsonb),
      p_from_blob,
      p_to_blob,
      p_entity_type, p_entity_id,
      p_field_group,
      p_meta
    )
    returning id into v_existing_id;

    return v_existing_id;
  end if;
end;
$$;

-- Original projects_admins (schema.sql); forward migration scopes project_id = p.id
CREATE OR REPLACE FUNCTION public.projects_admins(p public.projects)
  RETURNS SETOF public.users
  LANGUAGE sql STABLE
  AS $$
  select
    users.*
  from
    project_participants
  inner join
    users
  on
    project_participants.user_id = users.id
  where
    project_participants.is_admin = true and
    (
      project_participants.approved = true or
      exists(select 1 from projects where id = project_participants.project_id and projects.access_control = 'public')
    )
  ;
  $$;

COMMENT ON FUNCTION public.projects_admins(p public.projects) IS '@simpleCollections only';

REVOKE ALL ON FUNCTION public.projects_admins(p public.projects) FROM PUBLIC;
GRANT ALL ON FUNCTION public.projects_admins(p public.projects) TO seasketch_user;

-- --- Forward migration (resolvable layer comments) — commented out for WIP ---

-- -- Idempotent enum additions for changelog field groups
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_enum
--     JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
--     WHERE pg_type.typname = 'change_log_field_group'
--       AND pg_enum.enumlabel = 'resolvable_layer_comments:created'
--   ) THEN
--     ALTER TYPE change_log_field_group ADD VALUE 'resolvable_layer_comments:created';
--   END IF;
-- END
-- $$;

-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_enum
--     JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
--     WHERE pg_type.typname = 'change_log_field_group'
--       AND pg_enum.enumlabel = 'resolvable_layer_comments:responded'
--   ) THEN
--     ALTER TYPE change_log_field_group ADD VALUE 'resolvable_layer_comments:responded';
--   END IF;
-- END
-- $$;

-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_enum
--     JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
--     WHERE pg_type.typname = 'change_log_field_group'
--       AND pg_enum.enumlabel = 'resolvable_layer_comments:resolved'
--   ) THEN
--     ALTER TYPE change_log_field_group ADD VALUE 'resolvable_layer_comments:resolved';
--   END IF;
-- END
-- $$;

-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_enum
--     JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
--     WHERE pg_type.typname = 'change_log_field_group'
--       AND pg_enum.enumlabel = 'resolvable_layer_comments:reopened'
--   ) THEN
--     ALTER TYPE change_log_field_group ADD VALUE 'resolvable_layer_comments:reopened';
--   END IF;
-- END
-- $$;


-- -- Extend record_changelog merge windows for comment events (avoid coalescing distinct actions).
-- -- create or replace function record_changelog(
-- --   p_project_id   int,
-- --   p_editor_id    int,
-- --   p_entity_type  text,
-- --   p_entity_id    int,
-- --   p_field_group  change_log_field_group,
-- --   p_from_summary jsonb,
-- --   p_to_summary   jsonb,
-- --   p_from_blob    jsonb default null,
-- --   p_to_blob      jsonb default null,
-- --   p_meta         jsonb default null
-- -- ) returns bigint
-- -- language plpgsql
-- -- as $$
-- -- declare
-- --   v_now          timestamptz := clock_timestamp();
-- --   v_window       interval;
-- --   v_existing_id  bigint;
-- --   v_existing_last timestamptz;
-- -- begin
-- --   v_window :=
-- --     case p_field_group
-- --       when 'layer:metadata'::change_log_field_group then interval '10 seconds'
-- --       when 'layer:cartography'::change_log_field_group then interval '5 minutes'
-- --       when 'layer:interactivity'::change_log_field_group then interval '2 minutes'
-- --       when 'layers:published'::change_log_field_group then interval '5 seconds'
-- --       when 'layers:z-order-change'::change_log_field_group then interval '5 minutes'
-- --       when 'layer:uploaded'::change_log_field_group then interval '0 seconds'
-- --       when 'layer:downloadable'::change_log_field_group then interval '10 seconds'
-- --       when 'layer:deleted'::change_log_field_group then interval '0 seconds'
-- --       when 'folder:deleted'::change_log_field_group then interval '0 seconds'
-- --       when 'resolvable_layer_comments:created'::change_log_field_group then interval '0 seconds'
-- --       when 'resolvable_layer_comments:responded'::change_log_field_group then interval '0 seconds'
-- --       when 'resolvable_layer_comments:resolved'::change_log_field_group then interval '0 seconds'
-- --       when 'resolvable_layer_comments:reopened'::change_log_field_group then interval '0 seconds'
-- --       else interval '1 minute'
-- --     end;

-- --   select id, last_at
-- --     into v_existing_id, v_existing_last
-- --   from change_logs
-- --   where project_id = p_project_id
-- --     and editor_id = p_editor_id
-- --     and entity_type = p_entity_type
-- --     and entity_id = p_entity_id
-- --     and field_group = p_field_group
-- --     and status = 'open'
-- --   limit 1
-- --   for update;

-- --   if v_existing_id is not null then
-- --     if (v_now - v_existing_last) <= v_window then
-- --       update change_logs
-- --       set
-- --         last_at    = v_now,
-- --         save_count = save_count + 1,
-- --         to_summary = coalesce(p_to_summary, to_summary),
-- --         to_blob    = case
-- --                        when p_to_blob is null then to_blob
-- --                        else p_to_blob
-- --                      end
-- --       where id = v_existing_id;

-- --       return v_existing_id;
-- --     else
-- --       update change_logs
-- --       set status = 'closed'
-- --       where id = v_existing_id;

-- --       insert into change_logs (
-- --         project_id, editor_id,
-- --         started_at, last_at,
-- --         status, save_count,
-- --         from_summary, to_summary,
-- --         from_blob, to_blob,
-- --         entity_type, entity_id,
-- --         field_group, meta
-- --       ) values (
-- --         p_project_id, p_editor_id,
-- --         v_now, v_now,
-- --         'open', 1,
-- --         coalesce(p_from_summary, '{}'::jsonb),
-- --         coalesce(p_to_summary, '{}'::jsonb),
-- --         p_from_blob,
-- --         p_to_blob,
-- --         p_entity_type, p_entity_id,
-- --         p_field_group,
-- --         p_meta
-- --       )
-- --       returning id into v_existing_id;

-- --       return v_existing_id;
-- --     end if;
-- --   else
-- --     insert into change_logs (
-- --       project_id, editor_id,
-- --       started_at, last_at,
-- --       status, save_count,
-- --       from_summary, to_summary,
-- --       from_blob, to_blob,
-- --       entity_type, entity_id,
-- --       field_group, meta
-- --     ) values (
-- --       p_project_id, p_editor_id,
-- --       v_now, v_now,
-- --       'open', 1,
-- --       coalesce(p_from_summary, '{}'::jsonb),
-- --       coalesce(p_to_summary, '{}'::jsonb),
-- --       p_from_blob,
-- --       p_to_blob,
-- --       p_entity_type, p_entity_id,
-- --       p_field_group,
-- --       p_meta
-- --     )
-- --     returning id into v_existing_id;

-- --     return v_existing_id;
-- --   end if;
-- -- end;
-- -- $$;

-- create table if not exists resolvable_layer_comment(
--   id int generated always as identity primary key,
--   project_id int not null references projects(id) on delete cascade,
--   table_of_contents_item_id int not null references table_of_contents_items(id) on delete cascade,
--   comment jsonb not null,
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now(),
--   author_id int not null references users(id) on delete cascade,
--   resolved_at timestamptz,
--   resolved_by_id int references users(id) on delete set null,
--   parent_comment_id int references resolvable_layer_comment(id) on delete cascade
-- );

-- create index if not exists resolvable_layer_comment_toc_idx
--   on resolvable_layer_comment(table_of_contents_item_id);
-- create index if not exists resolvable_layer_comment_project_idx
--   on resolvable_layer_comment(project_id);
-- create index if not exists resolvable_layer_comment_parent_idx
--   on resolvable_layer_comment(parent_comment_id);

-- create or replace function public.resolvable_layer_comment_thread_root(p_comment resolvable_layer_comment)
--   returns resolvable_layer_comment
--   language plpgsql
--   stable
-- as $$
-- declare
--   cur resolvable_layer_comment;
-- begin
--   cur := p_comment;
--   while cur.parent_comment_id is not null loop
--     select * into cur from resolvable_layer_comment where id = cur.parent_comment_id;
--     if not found then
--       raise exception 'Invalid comment thread';
--     end if;
--   end loop;
--   return cur;
-- end;
-- $$;

-- create or replace function public.touch_resolvable_layer_comment_updated_at()
--   returns trigger
--   language plpgsql
-- as $$
-- begin
--   new.updated_at := now();
--   return new;
-- end;
-- $$;

-- drop trigger if exists resolvable_layer_comment_updated_at_trg on resolvable_layer_comment;
-- create trigger resolvable_layer_comment_updated_at_trg
--   before update on resolvable_layer_comment
--   for each row
--   execute function public.touch_resolvable_layer_comment_updated_at();

-- -- Prevent comments from being created for non-draft TOC items.
-- create or replace function public.enforce_resolvable_layer_comment_draft_toc()
--   returns trigger
--   language plpgsql
-- as $$
-- begin
--   if not exists (
--     select 1
--     from table_of_contents_items t
--     where t.id = new.table_of_contents_item_id
--       and t.is_draft = true
--   ) then
--     raise exception 'Comments may only be attached to draft table of contents items';
--   end if;
--   return new;
-- end;
-- $$;

-- drop trigger if exists enforce_resolvable_layer_comment_draft_toc_trg on resolvable_layer_comment;
-- create trigger enforce_resolvable_layer_comment_draft_toc_trg
--   before insert or update of table_of_contents_item_id
--   on resolvable_layer_comment
--   for each row
--   execute function public.enforce_resolvable_layer_comment_draft_toc();

-- alter table resolvable_layer_comment enable row level security;

-- grant select on resolvable_layer_comment to seasketch_user;

-- drop policy if exists resolvable_layer_comment_select on resolvable_layer_comment;
-- create policy resolvable_layer_comment_select on resolvable_layer_comment
--   for select to seasketch_user
--   using (session_is_admin(project_id));

-- revoke insert, update, delete on resolvable_layer_comment from seasketch_user;

-- -- RPC: create top-level comment or reply (author + changelog).
-- create or replace function public.create_resolvable_layer_comment(
--   table_of_contents_item_id int,
--   comment jsonb,
--   parent_comment_id int default null
-- ) returns resolvable_layer_comment
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_uid int := nullif(current_setting('session.user_id', true), '')::int;
--   v_toc table_of_contents_items%rowtype;
--   v_parent resolvable_layer_comment;
--   v_root resolvable_layer_comment;
--   v_row resolvable_layer_comment;
--   v_fg change_log_field_group;
--   -- Disambiguate from columns comment / parent_comment_id / table_of_contents_item_id in SQL below.
--   v_toc_id int := table_of_contents_item_id;
--   v_body jsonb := comment;
--   v_parent_id int := parent_comment_id;
-- begin
--   if v_uid is null then
--     raise exception 'Not authenticated';
--   end if;

--   select * into v_toc from table_of_contents_items where id = v_toc_id;
--   if not found then
--     raise exception 'Table of contents item not found';
--   end if;
--   if not v_toc.is_draft then
--     raise exception 'Comments may only be attached to draft table of contents items';
--   end if;
--   if not session_is_admin(v_toc.project_id) then
--     raise exception 'Forbidden';
--   end if;

--   if v_parent_id is null then
--     insert into resolvable_layer_comment (
--       project_id, table_of_contents_item_id, comment, author_id, parent_comment_id
--     ) values (
--       v_toc.project_id, v_toc_id, v_body, v_uid, null
--     )
--     returning * into v_row;

--     v_fg := 'resolvable_layer_comments:created'::change_log_field_group;
--   else
--     select * into v_parent from resolvable_layer_comment where id = v_parent_id;
--     if not found then
--       raise exception 'Parent comment not found';
--     end if;
--     if v_parent.table_of_contents_item_id <> v_toc_id then
--       raise exception 'Parent comment belongs to a different layer';
--     end if;

--     v_root := resolvable_layer_comment_thread_root(v_parent);
--     if v_root.resolved_at is not null then
--       raise exception 'Cannot reply to a resolved comment thread';
--     end if;

--     insert into resolvable_layer_comment (
--       project_id, table_of_contents_item_id, comment, author_id, parent_comment_id
--     ) values (
--       v_toc.project_id, v_toc_id, v_body, v_uid, v_parent_id
--     )
--     returning * into v_row;

--     v_fg := 'resolvable_layer_comments:responded'::change_log_field_group;
--   end if;

--   perform record_changelog(
--     v_toc.project_id,
--     v_uid,
--     'table_of_contents_items',
--     v_toc_id,
--     v_fg,
--     '{}'::jsonb,
--     '{}'::jsonb,
--     null,
--     null,
--     jsonb_build_object('comment_id', v_row.id)
--   );

--   return v_row;
-- end;
-- $$;

-- grant execute on function public.create_resolvable_layer_comment(int, jsonb, int) to seasketch_user;

-- comment on function public.create_resolvable_layer_comment is E'@graphqlName createResolvableLayerComment';

-- -- RPC: resolve the thread containing the given comment (sets resolution on root).
-- create or replace function public.resolve_resolvable_layer_comment(comment_id int)
--   returns resolvable_layer_comment
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_uid int := nullif(current_setting('session.user_id', true), '')::int;
--   v_comment resolvable_layer_comment;
--   v_root resolvable_layer_comment;
-- begin
--   if v_uid is null then
--     raise exception 'Not authenticated';
--   end if;

--   select * into v_comment from resolvable_layer_comment where id = comment_id;
--   if not found then
--     raise exception 'Comment not found';
--   end if;
--   if not session_is_admin(v_comment.project_id) then
--     raise exception 'Forbidden';
--   end if;

--   v_root := resolvable_layer_comment_thread_root(v_comment);
--   if v_root.resolved_at is not null then
--     raise exception 'Comment thread is already resolved';
--   end if;

--   update resolvable_layer_comment
--   set resolved_at = now(),
--       resolved_by_id = v_uid
--   where id = v_root.id
--   returning * into v_root;

--   perform record_changelog(
--     v_root.project_id,
--     v_uid,
--     'table_of_contents_items',
--     v_root.table_of_contents_item_id,
--     'resolvable_layer_comments:resolved'::change_log_field_group,
--     '{}'::jsonb,
--     '{}'::jsonb,
--     null,
--     null,
--     jsonb_build_object('comment_id', v_root.id)
--   );

--   return v_root;
-- end;
-- $$;

-- grant execute on function public.resolve_resolvable_layer_comment(int) to seasketch_user;

-- comment on function public.resolve_resolvable_layer_comment is E'@graphqlName resolveResolvableLayerComment';

-- -- RPC: reopen a resolved thread (clears resolution on root).
-- create or replace function public.reopen_resolvable_layer_comment(comment_id int)
--   returns resolvable_layer_comment
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   v_uid int := nullif(current_setting('session.user_id', true), '')::int;
--   v_comment resolvable_layer_comment;
--   v_root resolvable_layer_comment;
-- begin
--   if v_uid is null then
--     raise exception 'Not authenticated';
--   end if;

--   select * into v_comment from resolvable_layer_comment where id = comment_id;
--   if not found then
--     raise exception 'Comment not found';
--   end if;
--   if not session_is_admin(v_comment.project_id) then
--     raise exception 'Forbidden';
--   end if;

--   v_root := resolvable_layer_comment_thread_root(v_comment);
--   if v_root.resolved_at is null then
--     raise exception 'Comment thread is not resolved';
--   end if;

--   update resolvable_layer_comment
--   set resolved_at = null,
--       resolved_by_id = null
--   where id = v_root.id
--   returning * into v_root;

--   perform record_changelog(
--     v_root.project_id,
--     v_uid,
--     'table_of_contents_items',
--     v_root.table_of_contents_item_id,
--     'resolvable_layer_comments:reopened'::change_log_field_group,
--     '{}'::jsonb,
--     '{}'::jsonb,
--     null,
--     null,
--     jsonb_build_object('comment_id', v_root.id)
--   );

--   return v_root;
-- end;
-- $$;

-- grant execute on function public.reopen_resolvable_layer_comment(int) to seasketch_user;

-- comment on function public.reopen_resolvable_layer_comment is E'@graphqlName reopenResolvableLayerComment';

-- grant execute on function public.enforce_resolvable_layer_comment_draft_toc() to seasketch_user;

-- create or replace function projects_unresolved_layer_comments(p projects)
--   returns setof resolvable_layer_comment
--   language sql
--   security definer
--   stable
--   as $$
--     select *
--     from resolvable_layer_comment
--     where project_id = p.id
--       and parent_comment_id is null
--       and resolved_at is null;
--   $$;

-- grant execute on function projects_unresolved_layer_comments(projects) to seasketch_user;

-- comment on function projects_unresolved_layer_comments is '@simpleCollections only';

-- create or replace function table_of_contents_items_unresolved_layer_comments(t table_of_contents_items)
--   returns setof resolvable_layer_comment
--   language sql
--   security definer
--   stable
--   as $$
--     select *
--     from resolvable_layer_comment
--     where table_of_contents_item_id = t.id
--       and parent_comment_id is null
--       and resolved_at is null;
--   $$;

-- grant execute on function table_of_contents_items_unresolved_layer_comments(table_of_contents_items) to seasketch_user;

-- comment on function table_of_contents_items_unresolved_layer_comments is '@simpleCollections only';

-- create or replace function table_of_contents_items_resolved_layer_comments(t table_of_contents_items)
--   returns setof resolvable_layer_comment
--   language sql
--   security definer
--   stable
--   as $$
--     select r.*
--     from resolvable_layer_comment r
--     where r.table_of_contents_item_id = t.id
--       and r.parent_comment_id is null
--       and r.resolved_at is not null;
--   $$;

-- grant execute on function table_of_contents_items_resolved_layer_comments(table_of_contents_items) to seasketch_user;

-- comment on function table_of_contents_items_resolved_layer_comments is '@simpleCollections only';

-- -- Author / resolver profiles for comment UI (PostGraphile computed fields on ResolvableLayerComment).
-- create or replace function public.resolvable_layer_comment_author_profile(c resolvable_layer_comment)
--   returns user_profiles
--   language sql
--   stable
--   security definer
--   as $$
--     select * from public.user_profiles where user_id = c.author_id limit 1;
--   $$;

-- grant execute on function public.resolvable_layer_comment_author_profile(resolvable_layer_comment) to seasketch_user;

-- create or replace function public.resolvable_layer_comment_resolved_by_profile(c resolvable_layer_comment)
--   returns user_profiles
--   language sql
--   stable
--   security definer
--   as $$
--     select * from public.user_profiles where user_id = c.resolved_by_id limit 1;
--   $$;

-- grant execute on function public.resolvable_layer_comment_resolved_by_profile(resolvable_layer_comment) to seasketch_user;

-- -- projects_admins must scope to the project row passed from PostGraphile. Without
-- -- project_participants.project_id = p.id it returned admins from all projects, so the
-- -- same user appeared once per project they administer (e.g. six identical rows).
-- create or replace function public.projects_admins(p public.projects)
--   returns setof public.users
--   language sql
--   stable
--   as $$
--     select
--       users.*
--     from
--       project_participants
--     inner join
--       users
--     on
--       project_participants.user_id = users.id
--     where
--       project_participants.project_id = p.id
--       and project_participants.is_admin = true
--       and (
--         project_participants.approved = true
--         or exists(
--           select 1
--           from projects
--           where projects.id = p.id
--             and projects.access_control = 'public'
--         )
--       )
--     ;
--   $$;

-- grant execute on function public.projects_admins(public.projects) to seasketch_user;
-- comment on function public.projects_admins(public.projects) is '@simpleCollections only';
