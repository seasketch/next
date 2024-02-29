--! Previous: sha1:63ba0b9a11ac5bfd9fb712035ad2a0b6e050b7b4
--! Hash: sha1:62c0687190ac27bb6403a83230067117e73a0749

-- Enter migration here
drop function if exists table_of_contents_items_parent_folders;
create or replace function table_of_contents_items_contained_by(t table_of_contents_items)
  returns table_of_contents_items[]
  security definer
  stable
  language plpgsql
  as $$
    declare 
      parents table_of_contents_items[];
      parent table_of_contents_items;
    begin
      if t.parent_stable_id is null then
        return null;
      else
        select * into parent from table_of_contents_items where stable_id = t.parent_stable_id limit 1;
        parents := array_append(parents, parent);
        while parent.parent_stable_id is not null loop
          select * into parent from table_of_contents_items where stable_id = parent.parent_stable_id limit 1;
          if parent is null
          then
            return parents;
          end if;
          parents := array_append(parents, parent);
        end loop;
      end if;
      return parents;
    end;
  $$;

grant execute on function table_of_contents_items_contained_by to seasketch_user;

comment on function table_of_contents_items_contained_by is '@simpleCollections only';
