--! Previous: sha1:4ca95b211ea587deb1cd53962c645a50b4b62e89
--! Hash: sha1:112a8e56f9180201a9403c1aee3361faf1cc5468
--! Message: Preview draft layer links as the layer, not the project

-- Draft layer links are not public, so a crawler must not see the map
-- screenshot or the project description. The layer title is enough to tell
-- the link apart from the project. The image is the project logo, or the
-- SeaSketch logo when the project has none.

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
  logo text;
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

  select projects.name,
    case
      when projects.logo_url ~* '^https?://[^[:space:]<>"'']+$'
        then projects.logo_url
      else null
    end
  into project_name, logo
  from projects
  where projects.id = bookmark.project_id;

  if project_name is null or length(trim(project_name)) = 0 then
    project_name := 'SeaSketch';
  end if;

  select coalesce(array_agg(value order by value), '{}')
    into names
  from jsonb_each_text(coalesce(bookmark.layer_names, '{}'::jsonb))
  where length(trim(value)) > 0;

  if bookmark.kind = 'layer_link' and bookmark.subject_is_draft then
    title := nullif(trim(bookmark.layer_names ->> bookmark.subject_stable_id), '');
    if title is null and array_length(names, 1) is not null then
      title := names[1];
    end if;
    title := coalesce(title, 'Map layer');
    return jsonb_build_object(
      'title', title,
      'description', 'Bookmark requires authentication to access',
      'imageUrl', coalesce(logo, 'https://www.seasketch.org/logo512.png')
    );
  end if;

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
  'Title, description, and image for a shareable map link. A draft layer link uses the layer title, an authentication note, and the project logo.';
