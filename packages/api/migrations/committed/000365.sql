--! Previous: sha1:91c219d767330553e05f9ab60c993432116155f2
--! Hash: sha1:a4dfe0c8b3e916dcd11e60980df8f7e19b66a7bd

-- Enter migration here
create or replace function table_of_contents_item_by_stable_id(stable_id text)
  returns table_of_contents_items as $$
    -- get the table of contents item by stable id and return the first 
    -- available of published (is_draft = false) or draft (is_draft = true)
    select * from table_of_contents_items
    where stable_id = table_of_contents_item_by_stable_id.stable_id
    and (is_draft = false or is_draft = true)
    order by is_draft asc  -- false (published) comes before true (draft)
    limit 1;
  $$ language sql stable;

grant execute on function table_of_contents_item_by_stable_id to anon;

create or replace function table_of_contents_item_by_identifier(id int, stable_id text)
  returns table_of_contents_items as $$
    select * from table_of_contents_items
    where id = table_of_contents_item_by_identifier.id
    or stable_id = table_of_contents_item_by_identifier.stable_id
    limit 1;
  $$ language sql stable;

grant execute on function table_of_contents_item_by_identifier to anon;