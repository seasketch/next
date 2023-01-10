-- Enter migration here
alter table sketches add column if not exists post_id int references posts (id);
alter table sketches add column if not exists shared_in_forum boolean not null default false;

alter table sketch_folders add column if not exists post_id int references posts (id);
alter table sketch_folders add column if not exists shared_in_forum boolean not null default false;

-- hide shared_in_forum stuff from myPlans
CREATE OR REPLACE FUNCTION public.my_sketches("projectId" integer) RETURNS SETOF public.sketches
    LANGUAGE sql STABLE
    AS $$
    select
      *
    from
      sketches
    where
      it_me(user_id) and sketch_class_id in (
        select id from sketch_classes where project_id = "projectId") and response_id is null and shared_in_forum is false;
  $$;


-- hide shared_in_forum stuff from myPlans
CREATE OR REPLACE FUNCTION public.my_folders("projectId" integer) RETURNS SETOF public.sketch_folders
    LANGUAGE sql STABLE
    AS $$
    select * from sketch_folders where sketch_folders.project_id = "projectId" and it_me(sketch_folders.user_id) and shared_in_forum = false;
  $$;


-- Grant select access to posted sketches if the user has access to the given forum
drop policy if exists sketches_select on sketches;
CREATE POLICY sketches_select ON public.sketches FOR SELECT USING (
  (public.it_me(user_id) OR 
  (
    shared_in_forum = true and 
    post_id is not null and
    session_on_acl(
      (select id from access_control_lists where forum_id_read = (
        select forum_id from topics where id = (
          select topic_id from posts where id = post_id
        )
      ))
    )
  ) OR 
  public.session_is_admin(public.project_id_from_field_id(form_element_id)))
);

drop policy if exists sketch_folders_forum_read on sketch_folders;
create policy sketch_folders_forum_read on sketch_folders for select using (
  (public.it_me(user_id) OR (
    shared_in_forum = true and 
    post_id is not null and
    session_on_acl(
      (select id from access_control_lists where forum_id_read = (
        select forum_id from topics where id = (
          select topic_id from posts where id = post_id
        )
      ))
    )
  )
));

-- Need to update CopySketchTocItem to support a for_forum flag, 
-- same for copy_sketch_toc_item_recursive
CREATE OR REPLACE FUNCTION public.copy_sketch_toc_item_recursive_for_forum(parent_id integer, type public.sketch_child_type, append_copy_to_name boolean) 
  RETURNS integer
  security definer
  language plpgsql
  as $$
    declare
      copy_id int;
      sketch_child_ids int[];
      folder_child_ids int[];
    begin
      if type = 'sketch' then
        if it_me((select user_id from sketches where id = parent_id)) = false then
          raise exception 'Permission denied';
        end if;
      else
        if it_me((select user_id from sketch_folders where id = parent_id)) = false then
          raise exception 'Permission denied';
        end if;
      end if;
      -- perform copy
      select copy_sketch_toc_item_recursive(parent_id, type, append_copy_to_name) into copy_id;
      -- for both parent and sketch & folder children, assign shared_in_forum = true
      select get_child_sketches_and_collections_recursive(copy_id, type) into sketch_child_ids;
      select get_child_folders_recursive(copy_id, type) into folder_child_ids;
      if type = 'sketch' then
        update sketches set shared_in_forum = true where id = copy_id or id = any(sketch_child_ids);
      else
        update sketches set shared_in_forum = true where id = any(sketch_child_ids);
      end if;
      if type = 'sketch_folder' then
        update sketch_folders set shared_in_forum = true where id = copy_id or id = any(folder_child_ids);
      else
        update sketch_folders set shared_in_forum = true where id = any(folder_child_ids);
      end if;
      -- clear folder_id and collection_id on top-level parent
      if type = 'sketch' then
        update sketches set folder_id = null, collection_id = null where id = copy_id;
      else
        update sketch_folders set folder_id = null, collection_id = null where id = copy_id;
      end if;
      return copy_id;
    end;
  $$;

comment on function copy_sketch_toc_item_recursive_for_forum is '@omit';
grant execute on function copy_sketch_toc_item_recursive_for_forum to seasketch_user; 

-- add insert/update trigger to extract inline sketches from message_contents and assign post_id
