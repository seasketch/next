-- Enter migration here

-- undo
drop trigger if exists toc_item_metadata_sync_to_published on table_of_contents_items;
drop function if exists sync_toc_item_metadata_to_published();

-- redo

-- Create a trigger function that syncs metadata from draft to its published
-- counterpart whenever the draft's metadata is updated. This ensures that
-- metadata changes (e.g., links to external documentation) are immediately
-- visible to public users without requiring a full table-of-contents republish.
--
-- Both non-null and null values are synced: setting metadata to NULL on the
-- draft intentionally clears it from the published item immediately, so that
-- admins who remove metadata see that change reflected on the public side
-- without needing to republish.
--
-- Note: an index on stable_id already exists (table_of_contents_items_stable_id_idx
-- from migration 000332) so the UPDATE in this trigger is well-indexed.
create or replace function sync_toc_item_metadata_to_published()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if new.is_draft = true and new.stable_id is not null then
    update table_of_contents_items
    set metadata = new.metadata
    where stable_id = new.stable_id
      and is_draft = false;
  end if;
  return new;
end;
$$;

create trigger toc_item_metadata_sync_to_published
  after update of metadata on table_of_contents_items
  for each row
  execute function sync_toc_item_metadata_to_published();

-- One-time backfill: sync metadata from existing draft items to their published
-- counterparts for layers where metadata was added to the draft after the last
-- table-of-contents publish (leaving the published item with no metadata).
update table_of_contents_items as published
  set metadata = draft.metadata
  from table_of_contents_items as draft
  where draft.stable_id = published.stable_id
    and draft.is_draft = true
    and published.is_draft = false
    and draft.metadata is not null
    and published.metadata is null;
