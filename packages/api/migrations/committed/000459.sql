--! Previous: sha1:8e5209b56be9df6cacfbb6235370bc7b17c26009
--! Hash: sha1:379a46ca6f4c70925dc45522d4217dd50798f095

-- Descriptions for PendingPublishItem. PostGraphile copies these comments into
-- the GraphQL schema, and client codegen turns them into IntelliSense.

comment on type public.pending_publish_item is
  'One overlay row that a publish would add, update, or remove. This is the draft-versus-published diff.';

comment on column public.pending_publish_item.stable_id is
  'Stable id shared by the draft and published copies of this overlay row.';

comment on column public.pending_publish_item.kind is
  'How this row differs from the published overlay list. `added`: a draft row with no published row. `updated`: both copies exist and a publishable field still differs. `removed`: a published row with no draft row. A change that was made and then undone is omitted.';

comment on column public.pending_publish_item.title is
  'Draft title, or the published title when `kind` is `removed`.';

comment on column public.pending_publish_item.is_folder is
  'True when this row is a folder rather than a layer.';

comment on column public.pending_publish_item.parent_stable_id is
  'Stable id of the parent this row would be published under. For a removed row, the parent on the published tree.';

comment on column public.pending_publish_item.path is
  'Materialized path of this row in the tree the title came from: the draft tree, or the published tree when `kind` is `removed`.';

comment on column public.pending_publish_item.requires_stable_ids is
  'Other pending rows that must be published with this one. Includes new ancestor folders, moves required to avoid a cycle, and items moved out of a folder before that folder was removed.';

comment on column public.pending_publish_item.bundle_id is
  'Set when this row publishes as part of a group. A removed folder''s bundle id is that folder''s stable id, including items deleted with it. Layers that share a changed non-library source use `source:<draft source id>`. Null when the row can be published on its own.';

comment on column public.pending_publish_item.draft_id is
  'Id of the draft table_of_contents_items row. Null when `kind` is `removed`.';

comment on column public.pending_publish_item.included_in_bundle is
  'True for members of a bundle other than the row shown as the group''s checkbox. That checkbox is the removed folder, or the member with the lowest stable id in a shared-source bundle.';

comment on function public.projects_pending_publish_items(public.projects) is
  E'@simpleCollections only\nOverlay rows a publish would add, update, or remove. This is the draft-versus-published diff, so a change that was made and then undone is omitted. See `PendingPublishItem.kind`.';
