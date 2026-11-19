-- A data source is shared by every project that adds it from the data library:
-- the template layer, each consumer's draft layer, and each published copy.
-- The select/update policies below used that set as a scalar subquery
-- (`data_layer_id = (select id from data_layers where data_source_id = ...)`
-- and `(select 1 from table_of_contents_items where ...) is null`).
-- More than one row raises
-- "more than one row returned by a subquery used as an expression".
--
-- Superusers never hit it. session_is_admin() is true for every project, so
-- the leading OR/AND stops. A project admin is only an admin of their own
-- project. Library files live on the library project, so the admin falls
-- through into the scalar subquery (and, when that project is private, the
-- files are hidden instead). Publish, the changelog query, and the geography
-- layer picker all read those files.
--
-- The admin check is an index lookup on the layers in the current project,
-- not a scan of every consumer and not the end-user ACL walk.

create index if not exists data_layers_project_id_data_source_id_idx
  on public.data_layers (project_id, data_source_id);

create index if not exists table_of_contents_items_published_data_layer_id_idx
  on public.table_of_contents_items (data_layer_id)
  where is_draft = false and data_layer_id is not null;

create or replace function public.session_admin_uses_data_source(p_source_id integer)
returns boolean
language plpgsql
stable
security definer
parallel safe
set search_path to public, pg_temp
as $$
declare
  v_project_id integer;
begin
  -- One indexed probe when the request is scoped to a project. This is the
  -- path admin UI requests take. Fall back to the caller's other admin
  -- projects only when that probe misses, so a popular library source is not
  -- scanned layer by layer.
  v_project_id := nullif(current_setting('session.project_id', true), '')::integer;
  if session_is_admin(v_project_id) and exists (
    select 1
    from data_layers dl
    where dl.project_id = v_project_id
      and dl.data_source_id = p_source_id
  ) then
    return true;
  end if;

  return exists (
    select 1
    from project_participants pp
    join data_layers dl
      on dl.project_id = pp.project_id
     and dl.data_source_id = p_source_id
    where pp.user_id = nullif(current_setting('session.user_id', true), '')::integer
      and pp.is_admin
  );
end;
$$;

comment on function public.session_admin_uses_data_source(integer) is '@omit';

grant execute on function public.session_admin_uses_data_source(integer) to anon;

drop policy if exists data_layers_select on public.data_layers;
create policy data_layers_select on public.data_layers
  for select
  using (
    session_is_admin(project_id)
    or exists (
      select 1
      from table_of_contents_items toc
      where toc.is_draft = false
        and toc.data_layer_id = data_layers.id
        and _session_on_toc_item_acl(toc.path)
    )
  );

drop policy if exists data_layers_update on public.data_layers;
create policy data_layers_update on public.data_layers
  for update
  using (
    session_is_admin(project_id)
    and not exists (
      select 1
      from table_of_contents_items toc
      where toc.data_layer_id = data_layers.id
        and toc.is_draft = false
    )
  )
  with check (session_is_admin(project_id));

drop policy if exists data_sources_select on public.data_sources;
create policy data_sources_select on public.data_sources
  for select
  using (
    data_library_template_id is not null
    or session_is_admin(project_id)
    or session_admin_uses_data_source(id)
    or exists (
      select 1
      from data_layers dl
      join table_of_contents_items toc
        on toc.data_layer_id = dl.id
       and toc.is_draft = false
      where dl.data_source_id = data_sources.id
        and _session_on_toc_item_acl(toc.path)
    )
  );

drop policy if exists data_sources_update on public.data_sources;
create policy data_sources_update on public.data_sources
  for update
  using (
    session_is_admin(project_id)
    and (
      data_library_template_id is not null
      or not exists (
        select 1
        from data_layers dl
        join table_of_contents_items toc
          on toc.data_layer_id = dl.id
         and toc.is_draft = false
        where dl.data_source_id = data_sources.id
      )
    )
  )
  with check (session_is_admin(project_id));

drop policy if exists data_upload_outputs_select on public.data_upload_outputs;
create policy data_upload_outputs_select on public.data_upload_outputs
  for select
  using (
    -- Owning-project admins and superusers stop here. No join.
    session_is_admin(project_id)
    -- A consumer project's admin, including private library projects.
    or session_admin_uses_data_source(data_source_id)
    or (
      session_has_project_access(project_id)
      and exists (
        select 1
        from data_layers dl
        join table_of_contents_items toc
          on toc.data_layer_id = dl.id
         and toc.is_draft = false
        where dl.data_source_id = data_upload_outputs.data_source_id
          and _session_on_toc_item_acl(toc.path)
      )
    )
  );
