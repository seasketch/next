-- Title, description, and screenshot id for a link preview.
-- Crawlers request the page without a session, so this returns only those
-- fields, and only when the bookmark belongs to the project in the URL.
-- Draft layer links stay hidden: they are for signed-in administrators.
create or replace function public.bookmark_link_preview(
  slug text,
  id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  bookmark public.map_bookmarks;
  project_name text;
  names text[];
  title text;
  description text;
  shown text;
  extra int;
  width int;
  height int;
begin
  select map_bookmarks.* into bookmark
  from map_bookmarks
  join projects on projects.id = map_bookmarks.project_id
  where map_bookmarks.id = bookmark_link_preview.id
    and projects.slug = bookmark_link_preview.slug
    and projects.is_deleted is not true;

  if bookmark.id is null then
    return null;
  end if;

  if bookmark.kind = 'layer_link' and bookmark.subject_is_draft then
    return null;
  end if;

  select projects.name into project_name
  from projects
  where projects.id = bookmark.project_id;

  if project_name is null or length(trim(project_name)) = 0 then
    project_name := 'SeaSketch';
  end if;

  select coalesce(array_agg(value order by value), '{}')
    into names
  from jsonb_each_text(coalesce(bookmark.layer_names, '{}'::jsonb))
  where length(trim(value)) > 0;

  if bookmark.kind = 'layer_link' then
    title := nullif(trim(bookmark.layer_names ->> bookmark.subject_stable_id), '');
    if title is null and array_length(names, 1) is not null then
      title := names[1];
    end if;
    title := coalesce(title, 'Map layer');
    description := title || ' on the ' || project_name || ' map.';
  else
    title := 'Map bookmark';
    if array_length(names, 1) is null then
      description := 'A saved view of the ' || project_name || ' map.';
    else
      extra := greatest(array_length(names, 1) - 3, 0);
      shown := array_to_string(names[1:least(3, array_length(names, 1))], ', ');
      if extra > 0 then
        shown := shown || ' and ' || extra::text || ' more';
      end if;
      description := shown || ' on the ' || project_name || ' map.';
    end if;
  end if;

  if array_length(bookmark.map_dimensions, 1) = 2
     and bookmark.map_dimensions[1] > 0
     and bookmark.map_dimensions[2] > 0 then
    width := bookmark.map_dimensions[1];
    height := bookmark.map_dimensions[2];
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'title', title,
    'description', left(description, 240),
    'imageId', nullif(bookmark.image_id, ''),
    'width', width,
    'height', height
  ));
end;
$$;

comment on function public.bookmark_link_preview(slug text, id uuid) is
  'Title, description, and screenshot id for a shareable map link. Draft layer links are omitted.';

revoke all on function public.bookmark_link_preview(slug text, id uuid) from public;
grant execute on function public.bookmark_link_preview(slug text, id uuid) to anon;
grant execute on function public.bookmark_link_preview(slug text, id uuid) to seasketch_user;
