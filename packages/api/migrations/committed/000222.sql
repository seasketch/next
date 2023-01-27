--! Previous: sha1:3e66094de2ed6349dcd3c24d4b3cc0b3d3091a69
--! Hash: sha1:ded79908099093a62a388b51993e90170cedfcb9

-- Enter migration here



drop function if exists get_all_sketch_toc_children;
drop type if exists sketch_toc_child;

create or replace function lcfirst(word text)
returns text
language plpgsql
immutable
as $$
begin
  return lower(left(word, 1)) || right(word, -1);
end;
$$;

create or replace function camel_case(snake_case text)
returns text
language plpgsql
immutable
as $$
begin
  return
    replace(
      initcap(
        replace(snake_case, '_', ' ')
      ),
      ' ', ''
    );
end;
$$;

grant execute on function camel_case to anon;
grant execute on function lcfirst to anon;

create or replace function to_graphql_id(type text, id int)
  returns text
  language plpgsql
  immutable
  as $$
    begin
    return camel_case(type || ':' || id::text);
    end;
  $$;

grant execute on function to_graphql_id to anon;


CREATE OR REPLACE FUNCTION public.get_all_sketch_toc_children(parent_id integer, parent_type public.sketch_child_type) RETURNS 
    text[]
    LANGUAGE plpgsql
    AS $$
  declare
    ids text[] = '{}';
    child_ids text[];
    child record;
  begin
    if parent_type = 'sketch' then
      FOR child IN SELECT * FROM get_children_of_collection(parent_id)
      LOOP
        ids := ids || to_graphql_id(child.type::text, child.id::int);
        if child.is_leaf = false then
          select get_all_sketch_toc_children(child.id, child.type) into child_ids;
          ids := ids || child_ids;
        end if;
      END LOOP;
    else
      FOR child IN SELECT * FROM get_children_of_folder(parent_id)
      LOOP
        ids := ids || to_graphql_id(child.type::text, child.id::int);
        if child.is_leaf = false then
          select get_all_sketch_toc_children(child.id, child.type) into child_ids;
          ids := ids || child_ids;
        end if;
      END LOOP;
    end if;
    return ids;
  end;
  $$;

grant execute on function get_all_sketch_toc_children to seasketch_user;
comment on function get_all_sketch_toc_children is '@omit';
