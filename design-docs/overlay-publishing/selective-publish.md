# Selective Overlay Publishing

Admins edit a draft overlay list and publish it to end users. Today `publish_table_of_contents` replaces the whole published tree with a copy of the whole draft tree. The goal of this work is to let an admin publish **a subset of the pending changes** from the "Selective publish" modal (header split button, checkbox list), leaving everything else exactly as it is on the public map.

Partners rejected "freeze/pause" and per-item context-menu publishing. This document describes the semantics, hard constraints, dependency rules, UI behavior, and backend changes needed to make the checkbox modal coherent and data-safe.

Related: [Selective Overlay Publishing plan](../../.cursor/plans/selective_overlay_publishing_d3877543.plan.md) · mock UI in `packages/client/src/admin/data/MockSelectivePublishModal.tsx`.

## 1. Goals and non-goals

Goals

- An admin can publish any valid subset of pending overlay-list changes. Unselected published items keep their current public state; unselected new items stay unpublished.
- The published tree is always structurally valid after every publish (no orphans, unique stable ids, correct paths, a usable order).
- What a checkbox will do is legible from the list itself, without warning banners.
- Partial publish works by inspecting the two trees and copying the selected draft items onto the published one. It does not add changelog field groups or change what existing changelog rows store. It does not change `sort_index` or `z_index`. List order and stacking order ship only with a full publish.

Non-goals

- Publishing a *past* state of an item (rollback). Publishing always means "publish the current draft state of X".
- Publishing individual field edits of one item (e.g. only the title but not the cartography). See §3.
- Pausing or excluding layers from future full publishes.
- Changing the full publish. It stays a full replace and continues to ship everything, including changes the changelog does not track.

## 2. How publishing works today (facts the design depends on)

| Fact | Where | Consequence for selective publish |
| --- | --- | --- |
| Draft and published rows live in one table, split by `is_draft`. `id` changes on publish; `stable_id` is the identity shared by a draft row and its published counterpart. | `table_of_contents_items` | All matching between draft and published is by `(project_id, stable_id)`. |
| `path` is an ltree of ancestor stable ids; `parent_stable_id` names the parent. Path is computed on insert from the parent's path. | `before_insert_or_update_table_of_contents_items_trigger` | A published item's `path` is derived from the **published** parent chain at publish time, never copied from draft. |
| `sort_index integer` is per sibling group, rewritten 0..n-1 by `update_table_of_contents_item_children`. Reorders inside the same parent record **no changelog**; only `parent_stable_id` changes record `layer:parent-changed`. | `update_table_of_contents_item_*` | Partial publish does not write `sort_index`. An updated item keeps its published value. A new item is appended. Full publish copies the draft values. |
| `data_layers.z_index integer` is a project-wide stacking order, rewritten 1..n by `update_z_indexes`, recorded as one project-level `layers:z-order-change` row. | `update_z_indexes` | Partial publish does not write `z_index`, same rule as `sort_index`. The full-publish modal still lists `layers:z-order-change` until a full publish. |
| Deleting a folder deletes its subtree one row at a time, firing `layer:deleted` / `folder:deleted` per item with `from_summary = {title, is_folder}`. The rows are keyed by the old draft `id`; they do not carry `stable_id`. | `delete_table_of_contents_branch`, `trg_changelog_table_of_contents_items_deleted` | Removals are discovered from the **tree diff** (published `stable_id` with no draft row), not from the changelog (§5.3). |
| Deleting a draft layer whose `stable_id` is referenced by a report card is refused. | `_delete_table_of_contents_item` | Report references are enforced at edit time, not publish time. |
| Published rows are immutable (`Cannot alter table of contents items after they are published`) unless `seasketch.skip_library_source_side_effects` is set. | `before_insert_or_update_table_of_contents_items_trigger` | Publishing a changed item is delete-and-recopy of its published rows. The few derived-column rewrites in §6 run under a publish-time bypass. |
| Publish copies, per layer: `interactivity_settings`, `data_layers`, ACL type + groups, active `overlay_data_tables` (matched by TOC `stable_id`), and one copy of each non-library `data_source`, repointing published layers at it. Data-library sources are shared, not copied. Column lists are hard-coded. | `publish_table_of_contents` | A layer's "state" is the union of these rows. The per-item copy is factored into a helper so full and partial publish share one column list. |
| `data_sources.attribution` / `temporal` changes record a changelog row on **every** draft layer using that source. | `trg_changelog_data_sources_*_for_toc` | Source-level edits are shared state across layers (§5.6). |
| After the mutation, the API rewrites the project's hosted-tiles ACL document from the published tree. | `publishTilesAclPlugin.ts` | Must run after every publish, full or partial. |
| "Changes since last publish" = changelog rows with `last_at > projects.table_of_contents_last_published`. | `projects_change_logs_since_last_publish` | A single project timestamp cannot describe a partially published project; the boundary becomes per item (§6.2). |

## 3. Core model: the unit of publication is an item's current state

The checkbox list is rendered from changelog rows, but **what is published is never a changelog row**. The unit of publication is one item, `Item(stable_id)`: publish the complete current draft state of a layer or folder (TOC row, data layer, source, interactivity, ACL, data tables), or remove its published copy if it no longer exists in draft. Every item has at most one unit:

- **Added** — draft row exists, no published row.
- **Updated** — both exist, and the draft has pending changelog rows (§6.2). Includes moves.
- **Removed** — published row exists, no draft row.

There is no stacking-order checkbox. `layers:z-order-change` stays on the full-publish review until a full publish (§5.5).

Consequences, which answer the first two notes in the brief:

1. Selecting a layer publishes *all* of its edits. The pills on its row (title, cartography, metadata, …) are an explanation, not individually selectable.
2. A Removed item publishes only the removal. Its earlier edits are moot; the list does not show them.
3. An item created and deleted since the last publish has no unit at all. It appears in history only.
4. An item deleted in draft and re-created with the same title gets a new `stable_id`, so it appears as one Removed unit and one independent Added unit.

## 4. Change types and which unit they belong to

| Changelog field group | Unit | Notes |
| --- | --- | --- |
| `layer:title`, `layer:metadata`, `layer:attribution`, `layer:cartography`, `layer:downloadable`, `layer:acl`, `layer:interactivity`, `layer:temporal`, `layer:uploaded` (source replaced), `layer:parent-changed` | `Item(layer)` Updated/Added | Pills on the row. |
| `folder:title`, `folder:acl`, `folder:type` (click-off / radio / hide children), `layer:parent-changed` on a folder | `Item(folder)` Updated/Added | Folder ACL and type changes affect how descendants display and who sees them, but they are folder state; descendants are not modified. |
| `folder:created`, `layer:uploaded` on a brand-new layer, `data_source.created_at` newer than the published copy | `Item` Added | |
| `layer:deleted`, `folder:deleted` | display only | The Removed unit comes from the tree diff; the row is matched by title for the editor avatar and timestamp when the match is unambiguous. |
| `data_table:*` | `Item(layer)` Updated | Data tables belong to the layer via `table_of_contents_item_id`; published copies are matched by table `stable_id`. |
| `layers:z-order-change` | Not a partial-publish unit | Stays in the full-publish review until a full publish. |
| `resolvable_layer_comments:*` | none | Comments are workflow, not published state. Shown as context in the full review, never a checkbox. |
| Sibling reorders; fields with no trigger (`bounds`, `render_under`, `source_layer`, …) | none | Not visible as pending today either. Full publish ships them; a partial publish of that item also ships them because the item is copied whole. |

## 5. Hard constraints vs. UI conveniences

A **hard constraint** is something the server must enforce or the published tree becomes invalid or incoherent. A **convenience** is something the UI does so the admin does not have to think about the constraint. The server recomputes the closure of a selection and expands it (§6.3), so UI bindings are never the only line of defense.

### 5.1 Atomic item state (hard)

An item is published whole. Partial field publication is impossible because the published copy is produced by copying the current draft rows.

### 5.2 Parent must exist in the target tree (hard)

Define the **target tree** as: the published tree, minus selected Removed units, plus the draft state of selected Added/Updated units.

Rule: every item in the target tree must have its draft `parent_stable_id` present in the target tree (or be at root).

- Added item whose draft parent is an Added folder ⇒ **requires** `Item(parent)`, transitively for nested new folders.
- Updated item moved into an Added folder ⇒ **requires** `Item(parent)`.
- Updated item moved into a *published* folder ⇒ no dependency. Whether that folder is itself Updated (renamed, moved, re-ACL'd) is irrelevant; the child only needs it to exist.
- An item can never be moved into a Removed folder in draft (the folder no longer exists there), so that conflict cannot occur.

Convenience: checking the child auto-checks the required folder(s) and shows them as linked (§7).

### 5.3 Removing a folder empties it (hard)

Removed units and their bundles are computed from the **published** tree: a published folder F with no draft counterpart is Removed, and its published descendants are found by `path <@ F.path`. Each descendant D is in one of two states in draft:

- D has no draft row (deleted with the folder, the normal case) ⇒ D is its own Removed unit, **bound** to F. The UI shows one row with a nested count.
- D has a draft row elsewhere (moved out before F was deleted) ⇒ `Item(D)` is Updated (moved). `Removed(F)` **requires** `Item(D)`, otherwise D would be orphaned in the published tree.

Publishing a removal deletes the published TOC row and, by cascade or explicit delete, its data layer, interactivity settings, ACL, data tables, and the data source if no remaining published layer references it. Nothing in the changelog is consulted or stored.

### 5.4 Sibling order is not partially published

Partial publish does not change `sort_index`.

- An Updated item keeps the `sort_index` of the published row it replaces.
- An Added item is appended: `max(sort_index) + 1` among the published children of its published parent.
- A pure reorder has no checkbox. `draft_table_of_contents_has_changes` stays true so the full Publish button can still ship it.
- Full publish copies draft `sort_index` values, as it does today.

### 5.5 Z-order is not partially published

Same rule as §5.4, on `data_layers.z_index`.

- An Updated layer keeps its published `z_index`.
- An Added layer is appended at `max(z_index) + 1` among published layers.
- There is no stacking checkbox. `layers:z-order-change` remains in `projects_change_logs_since_last_publish` until a full publish, because partial publish does not move `projects.table_of_contents_last_published`.
- The blue Publish button stays available while the relative stacking of layers present in both trees differs.

### 5.6 Shared data sources (hard for coherence, cheap to enforce)

Several draft layers can share one `data_source` (ArcGIS services, multi-layer vector tiles, exploded uploads). Source-level fields (`attribution`, `temporal`, the source row itself after a replace) are copied once per publish and all published layers from that source point at the copy.

Rule: if a source-level change is pending on source S, all Item units for layers using S are **bound**. Otherwise two published copies of S with different attributions would coexist and the map would show both.

Layer-only changes (style, title, metadata, interactivity, ACL) on layers sharing a source do not bind.

Data-library sources are shared and never copied, so library-source edits are already live and never appear as pending.

### 5.7 Moving a folder moves its subtree (hard, but no selection dependency)

Moving folder G changes `parent_stable_id` on G only; descendants keep their `parent_stable_id` and only their `path` changes. Publishing `Item(G)`:

- requires nothing from descendants,
- rewrites `path` on every published descendant of G (selected or not) to the new ancestor chain. This is derived-column maintenance under the bypass, not a state change, so descendants are not Updated.

### 5.8 Folder ACL and behaviour inherit (not a constraint)

`_session_has_toc_access` evaluates ACLs along `path`, and radio/hide-children behaviour is read from the parent at render time. Publishing a folder's ACL or type change affects published descendants without touching their rows. No binding; the pill reads "Access (applies to contents)".

### 5.9 Concurrency (hard)

- Every publish takes `pg_advisory_xact_lock(hashtext('publish_toc:' || project_id))`.
- The selection is resolved against the draft at publish time. If an editor changes an item between the modal opening and the publish, the latest draft state of selected items ships (consistent with §3).
- Two editors' edits to the same item are one unit; there is no per-editor publishing.

### 5.10 Blocked at edit time, not publish time

- Deleting a draft layer referenced by a report card is refused.
- `is_folder` cannot change, so no Updated unit changes kind.

## 6. Backend design

### 6.1 Shared copy helpers

`_publish_copy_draft_toc_item(draft_id, sort_index, z_index)` copies one draft item (interactivity settings, `data_layers`, TOC row with derived path, ACL type + groups, active `overlay_data_tables`). Null `sort_index` / `z_index` means append. Full publish keeps its own loop and copies draft order. `published_at` is a column on that insert (`clock_timestamp()`), not a trigger.

### 6.2 Pending state per item

One schema addition, not on the changelog: `table_of_contents_items.published_at timestamptz`, set on published rows when they are written (full or partial). Then:

- Added = draft row without a published `stable_id` match.
- Removed = published row without a draft match (bundles via published `path`).
- Updated = match where a changelog row for the draft item has `last_at > published.published_at`, or where the draft layer's non-library source (url, attribution, temporal) or its style, render-under, or sublayer differs from the published copy. The structural check catches a source replacement that never recorded `layer:uploaded`.
- Order is not a pending unit. Sibling-order and z-order differences still keep `draft_table_of_contents_has_changes` true.

`published_at` is `clock_timestamp()` on the publish insert, not `now()`, so edits made earlier in the same transaction are not still pending after the row is written. There is no insert trigger for it.

`projects_change_logs_since_last_publish` keeps the `last_at > table_of_contents_last_published` range, then drops rows whose item was partial-published after that changelog entry. `projects_comments_since_last_publish` uses the same per-item cutoff. Partial publish does **not** move `table_of_contents_last_published`, so that timestamp stays the last full publish. `draft_table_of_contents_has_changes` is recomputed from the tree diff after a partial publish, including order differences and the source/interactivity fields a full publish copies.

No new field groups, and nothing new is written into `from_summary`, `to_summary`, blobs, or `meta`. A partial publish records the existing `layers:published` row exactly as the full publish does.

### 6.3 Mutation

`publish_table_of_contents_items(project_id, stable_ids text[])`:

1. Advisory lock; permission check; `set_config('seasketch.publishing', 'true', true)` so the per-row triggers listed below return immediately.
2. Compute units and edges (`requires`, `bound`) from the two trees; expand `stable_ids` to the closure.
3. Removed units, deepest `path` first: delete published rows and dependents (§5.3).
4. Added/Updated units, ancestors first: remember the published `sort_index` and `z_index` if the row exists, delete the stale copy, `_publish_copy_draft_toc_item` with those values or null to append.
5. Copy sources for the layers written in this run; repoint. `bucket_id` and `object_key` are copied because the source insert trigger is not filling them.
6. Rewrite `path` for descendants of moved folders (§5.7). Do not renumber `sort_index` or `z_index`.
7. Clear `seasketch.publishing`. Recompute `draft_table_of_contents_has_changes`. Do not change `table_of_contents_last_published`. Record `layers:published`. Return the published rows written.
8. `publishTilesAclPlugin` rewrites the tiles ACL document for this mutation as well as full publish.

`seasketch.publishing` bails out of: the TOC before-insert validation (published rows only), `table_of_contents_items_project_update`, the data-layer and data-source before triggers, the "draft has changes" triggers on layers, sources, and ACLs, the upload-replacement changelog on `data_source_id`, the TOC insert changelogs, `record_project_activity_on_delete`, and `after_deleted__data_upload_outputs`. Full publish sets the same flag for its copy loop and clears it before returning. The backfill of `published_at` sets the flag too, so it does not mark every project unpublished.

### 6.4 Known limitation left for a later update

`table_of_contents_items_related_publish_change_logs` attributes publishes to layers by time window. Without storing membership it may list a partial publish in the history of a layer it did not include. Fixing that needs a record of what each run shipped, which is out of scope for this update.

## 7. UI behaviour

The modal keeps the shape of the mock (title, explanatory sentence, grouped sections, "Publish N selected"). Rows are **units**: Added, Updated, Removed. Stacking order is not a row.

Row anatomy

- Checkbox, item icon, title, pills (reusing the summarized-change pills), editor avatars, and a muted breadcrumb of the draft path (`Habitats › Benthic`). A breadcrumb segment that is itself an Added folder renders as a small pill so the dependency is visible before any click.
- Removed folders render with a disclosure: "Benthic habitats *and 12 items inside*", nested rows indented and dimmed with no checkbox (bound, §5.3). Bound shared-source layers (§5.6) are grouped the same way under a "Shared source" header.

Selection mechanics (bind, don't warn)

- Selections are tracked as *explicit* (clicked) or *implied* (added by closure). Checking a unit adds its closure as implied.
- Implied rows render **checked with a link glyph** (Radix `Link2Icon` in place of the check) and a one-line muted caption: "Included with *Coral cover 2024*". Hovering or focusing either row highlights the pair with a shared background; a tooltip (`aria-describedby`) carries the same sentence for assistive tech.
- Clicking an implied row makes it explicit (stays checked). It cannot be unchecked while a dependent is explicit; the click nudges the dependents instead of showing a dialog.
- Unchecking an explicit row drops implied rows nothing else needs.
- Unchecking a required explicit row (e.g. the new folder) while dependents are explicitly checked cascades: dependents are unchecked and briefly highlighted. The admin asked for it, so no confirmation.
- Section "select all" selects explicit for the section and runs closure; rows pulled from another section show there as implied.
- Footer: "Publish 4 selected" with a muted "+ 2 included" when implied rows exist.
- New layers are appended. The modal does not describe a stacking placement.

After publishing

- Modal closes; toast "Published 6 changes". Remaining pending units stay listed; the header indicator stays on while any remain.

Full publish

- The primary Publish button keeps the existing review panel, now fed by the same per-item pending data, and calls the existing `publish_table_of_contents`.

## 8. Scenario catalog

Each row: what the admin did → the unit(s) → rule → what the UI does.

Layers

1. Edited title, metadata, and style of a published layer → one Updated unit, three pills → §5.1 → one checkbox.
2. Edited a layer, then deleted it → one Removed unit (from tree diff) → §3 → row shows the published title, no pills; editor avatar if the `layer:deleted` row matches by title.
3. Created a layer, then deleted it → no unit → §3 → absent from the list; history only.
4. Uploaded a new layer and styled it → one Added unit → §5.1 → one checkbox; appended in list order and stacking order.
5. Replaced a layer's source and restyled → one Updated unit → §5.1 → one checkbox; the stale published source copy is dropped when unreferenced.
6. Duplicated a layer → Added unit with a fresh `stable_id` → independent.
7. Toggled downloads / interactivity / temporal → Updated pills; nothing special.
8. Changed a field with no changelog trigger (bounds, render_under) and nothing else → not listed (as today) → ships with the next full publish, or with this item when it is selected for another reason.
9. Edited a source-level field (attribution/temporal) on a shared source → all layers on that source bound → §5.6 → grouped under "Shared source", one checkbox.
10. Edited only the style of one layer sharing a source → single unit → no binding.
11. Data-library layer whose library source was updated → no pending unit → already live.
12. Added/replaced/deleted a data table on a layer → Updated with "Data tables" pill → one checkbox.

Moves

13. Moved a layer into an existing published folder → Updated (moved) → §5.2 → single checkbox; breadcrumb shows the destination; it is appended among that folder's published children.
14. Moved a layer into a new folder → requires the Added folder → §5.2 → checking the layer links the folder.
15. Moved a layer into a new folder inside another new folder → requires both, transitively.
16. Created a folder, moved layers in, checked only the folder → folder publishes empty; layers stay where they are publicly → valid.
17. Moved a layer out of folder A, then deleted A → `Removed(A)` requires the layer's Updated unit → §5.3 → checking A links the layer; checking only the layer is fine.
18. Moved a layer from new folder A to new folder B before publishing → requires only B.
19. Moved a folder with contents → one Updated unit on the folder → §5.7 → descendants not listed; their published `path` is rewritten.
20. Moved a folder *and* edited a child → two independent units; any combination is valid.

Folders

21. Deleted a folder with its contents → `Removed(folder)` bound with each published descendant → §5.3 → one row with "and N items inside".
22. Deleted a folder after moving some contents out and deleting the rest → bound with the deleted ones, requires the moved ones → nested removed items plus linked moved rows in Updated.
23. Renamed a folder → Updated → no dependency.
24. Changed folder ACL → Updated, "Access (applies to contents)" → §5.8 → no dependency.
25. Changed folder behaviour (radio / hide children / click-off) → Updated → no dependency.
26. Created an empty folder → Added → publishable alone.
27. New folder with a new child; admin checks only the child → folder implied.

Ordering

28. Reordered siblings within a folder, nothing else → not listed → full Publish stays available and ships the order.
29. Added a layer and reordered its siblings; admin checks the layer → layer is appended; existing published sibling order is unchanged → §5.4.
30. Moved a published layer within its folder *and* edited it → Updated; the edit ships and the published position does not → §5.4.
31. Changed only z-order, or changed z-order and published some other edit → stacking is unchanged; full Publish ships it → §5.5.
32. Added a layer while the draft stack was reordered → the new layer is appended; other published layers keep their relative stack → §5.5.
33. An empty selection → nothing is published, including stacking order.

Multi-editor and timing

34. A edits X; B edits Y; A publishes only X → Y stays pending with B's avatar → §6.2.
35. A opens the modal; B edits X before A publishes → X ships in its latest state → §5.9.
36. Two admins publish concurrently → serialized by the advisory lock; the second run finds some selections no longer pending and skips them.
37. Same selection published twice → second run is a no-op.

Cross-cutting

38. Any publish → tiles ACL document rewritten from the resulting published tree.
39. Partial publish → one `layers:published` row with the existing shape; per-layer history may over-attribute it (§6.4).
40. Full publish → unchanged full replace; also ships reorders and untracked field changes.

## 9. Open questions

- Resolved: partial publish does not ship `sort_index` or `z_index`. Full publish does.
- Published reports referencing layers: should publishing a Removed layer check published report cards, or is a dangling reference acceptable?
- Whether the per-item pending computation lives in SQL (shared with the mutation's closure) or a plugin. One SQL implementation is preferred.
