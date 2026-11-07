# Selective Overlay Publishing

Admins edit a draft overlay list and publish it to end users. Today `publish_table_of_contents` replaces the whole published tree with a copy of the whole draft tree. The goal of this work is to let an admin publish **a subset of the pending changes** from the "Selective publish" modal (header split button, checkbox list), leaving everything else exactly as it is on the public map.

Partners rejected "freeze/pause" and per-item context-menu publishing. This document describes the semantics, hard constraints, dependency rules, UI behavior, and backend changes needed to make the checkbox modal coherent and data-safe.

Related: [Selective Overlay Publishing plan](../../.cursor/plans/selective_overlay_publishing_d3877543.plan.md) (an earlier proposal; this document supersedes it where they differ) · UI in `packages/client/src/admin/data/SelectivePublishModal.tsx` · SQL in `packages/api/migrations/current.sql`.

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
- Changing what a full publish ships. It still makes the published list match the draft, including order and changes the changelog does not track. It now does that by copying only the items that differ (§6.3).

## 2. How publishing works today (facts the design depends on)

| Fact | Where | Consequence for selective publish |
| --- | --- | --- |
| Draft and published rows live in one table, split by `is_draft`. `id` changes on publish; `stable_id` is the identity shared by a draft row and its published counterpart. | `table_of_contents_items` | All matching between draft and published is by `(project_id, stable_id)`. |
| `path` is an ltree of ancestor stable ids; `parent_stable_id` names the parent. Path is computed on insert from the parent's path. | `before_insert_or_update_table_of_contents_items_trigger` | A published item's `path` is derived from the **published** parent chain at publish time, never copied from draft. |
| `sort_index integer` is per sibling group, rewritten 0..n-1 by `update_table_of_contents_item_children`. Reorders inside the same parent record **no changelog**; only `parent_stable_id` changes record `layer:parent-changed`. | `update_table_of_contents_item_*` | Partial publish does not write `sort_index`. An updated item keeps its published value. A new item is appended. Full publish writes the draft values onto every published row. |
| `data_layers.z_index integer` is a project-wide stacking order, rewritten 1..n by `update_z_indexes`, recorded as one project-level `layers:z-order-change` row. | `update_z_indexes` | Partial publish does not write `z_index`, same rule as `sort_index`. The full-publish modal still lists `layers:z-order-change` until a full publish. |
| Deleting a folder deletes its subtree one row at a time, firing `layer:deleted` / `folder:deleted` per item with `from_summary = {title, is_folder}`. The rows are keyed by the old draft `id`; they do not carry `stable_id`. | `delete_table_of_contents_branch`, `trg_changelog_table_of_contents_items_deleted` | Removals are discovered from the **tree diff** (published `stable_id` with no draft row), not from the changelog (§5.3). |
| Deleting a draft layer whose `stable_id` is referenced by a report card is refused. | `_delete_table_of_contents_item` | Report references are enforced at edit time, not publish time. |
| Published rows are immutable (`Cannot alter table of contents items after they are published`) unless `seasketch.skip_library_source_side_effects` is set. | `before_insert_or_update_table_of_contents_items_trigger` | Publishing a changed item is delete-and-recopy of its published rows. The few derived-column rewrites in §6 run under a publish-time bypass. |
| Publish copies, per layer: `interactivity_settings`, `data_layers`, ACL type + groups, active `overlay_data_tables` (matched by TOC `stable_id`), and one copy of each non-library `data_source`, repointing published layers at it. Data-library sources are shared, not copied. Column lists are hard-coded. | `publish_table_of_contents` | A layer's "state" is the union of these rows. The per-item copy is factored into a helper so full and partial publish share one column list. |
| `data_sources.attribution` / `temporal` changes record a changelog row on **every** draft layer using that source. | `trg_changelog_data_sources_*_for_toc` | Source-level edits are shared state across layers (§5.6). |
| After the mutation, the API rewrites the project's hosted-tiles ACL document from the published tree. | `publishTilesAclPlugin.ts` | Must run after every publish, full or partial. |
| "Changes since last publish" = changelog rows with `last_at > projects.table_of_contents_last_published`. | `projects_change_logs_since_last_publish` | A single project timestamp cannot describe a partially published project; the boundary becomes per item (§6.2). |

## 3. Core model: the unit of publication is an item's current state

The checkbox list comes from comparing the draft tree with the published tree. Changelog rows only explain a row (pills, editors); they never decide whether a row exists, and **what is published is never a changelog row**. The unit of publication is one item, `Item(stable_id)`: publish the complete current draft state of a layer or folder (TOC row, data layer, source, interactivity, ACL, data tables), or remove its published copy if it no longer exists in draft. Every item has at most one unit:

- **Added** — draft row exists, no published row.
- **Updated** — both exist, and the published copy no longer matches the draft (§6.2). Includes moves.
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
| Fields with no changelog trigger (`bounds`, `render_under`, `source_layer`, `translated_props`, source `geostats`, …) | `Item` Updated | Found by the tree comparison. The row has no pills, so it shows an "Other changes" pill. |
| Sibling reorders | none | Full publish ships them (§5.4). |

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
- Updated item moved into a folder that is still inside it on the published tree (A contained B; in draft B moved out and A moved into B) ⇒ **requires** the moved items on the published chain between them. Publishing A alone would make A and B each other's parent and drop both from the public list.

Only the unbroken run of Added folders directly above an item is required. A published folder in between already exists on the target tree, so the Added folders above it are not needed.

Convenience: checking the child auto-checks the required folder(s) and shows them as linked (§7).

### 5.3 Removing a folder empties it (hard)

Removed units and their bundles are computed from the **published** tree: a published folder F with no draft counterpart is Removed, and its published descendants are found through the published parent chain. Each descendant D is in one of two states in draft:

- D has no draft row (deleted with the folder, the normal case) ⇒ D is its own Removed unit, **bound** to F. The UI shows one row with a nested count.
- D has a draft row elsewhere (moved out before F was deleted) ⇒ `Item(D)` is Updated (moved). `Removed(F)` **requires** `Item(D)`, otherwise D would be orphaned in the published tree.

Publishing a removal deletes the published TOC row and, by cascade or explicit delete, its data layer, interactivity settings, ACL, data tables, and the data source if no remaining published layer references it. Nothing in the changelog is consulted or stored.

### 5.4 Sibling order is not partially published

Partial publish does not change `sort_index`.

- An Updated item keeps the `sort_index` of the published row it replaces, unless it moved to another folder; then it is appended there.
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

When a partial publish writes a layer whose source has no pending change, it points the layer at the published copy that the other published layers on that source already use. A new copy is made only when no matching copy exists, so a shared source is not duplicated on the public map.

### 5.7 Moving a folder moves its subtree (hard, but no selection dependency)

Moving folder G changes `parent_stable_id` on G only; descendants keep their `parent_stable_id` and only their `path` changes. Publishing `Item(G)`:

- requires nothing from descendants,
- changes `path` on every published descendant of G (selected or not). After every partial publish, all published paths are rebuilt from the published parent chain under the bypass, so moves at any depth and in any order stay consistent. This is derived-column maintenance, not a state change, so descendants are not Updated.

After rebuilding paths the mutation checks that every published item is reachable from the root. A missing parent or a parent cycle raises an error naming the item and rolls the publish back. The closure rules above should make this unreachable; the check is a last line of defence.

### 5.8 Folder ACL and behaviour inherit (not a constraint)

`_session_has_toc_access` evaluates ACLs along `path`, and radio/hide-children behaviour is read from the parent at render time. Publishing a folder's ACL or type change affects published descendants without touching their rows. No binding; the pill reads "Access (applies to contents)".

### 5.9 Concurrency (hard)

- Every publish takes `pg_advisory_xact_lock(hashtext('publish_toc:' || project_id))`.
- The selection is resolved against the draft at publish time. If an editor changes an item between the modal opening and the publish, the latest draft state of selected items ships (consistent with §3).
- Two editors' edits to the same item are one unit; there is no per-editor publishing.

### 5.10 Blocked at edit time, not publish time

- Deleting a draft layer referenced by a report card is refused.
- `is_folder` cannot change, so no Updated unit changes kind.

### 5.11 Reports

- Report cards reference layers by `stable_id`. A published report resolves them against the published list and a draft report against the draft list (`report_overlay_source_refs_by_stable_ids`). Publishing a layer, fully or selectively, moves end users to its new version, including on reports published earlier. Draft reports switch as soon as the new version is preprocessed.
- `publish_report_snapshot` refuses while any referenced layer's draft source url differs from its published source url. The admin client answers that error by publishing the layer list and then the report.
- Preprocessing doesn't block publishing. A published copy keeps the draft source's url but has no processing job of its own, so if it was published before preprocessing finished it has no reporting output either. Report resolution then falls back to the output or job of the same-url source in the project (`reporting_ref_from_same_url_source`). End users see the layer as processing in the card and in Calculation details, and their metrics wait on that job (`DEPENDENCY_NOT_READY`) instead of failing to resolve.
- When the job completes, `trigger_queue_spatial_metrics_on_source_complete` copies the reporting output onto published copies that have none, so they match the draft and drop out of the publish modal. It runs once per job, not per published row during publish.
- `publish_report_snapshot` queues preprocessing for a referenced draft layer that has neither an output nor a job. It refuses only when that layer's preprocessing failed.
- Covered by `packages/e2e/tests/report-overlay-versions.spec.ts` (version upload through publish, and publishing while preprocessing is held, on local workers) and `packages/api/tests/reportPublishVersionGuard.test.ts`.

## 6. Backend design

### 6.1 Shared copy helpers

`_publish_copy_draft_toc_item(draft_id, sort_index, z_index, path)` copies one draft item (interactivity settings, `data_layers`, TOC row, ACL type + groups, active `overlay_data_tables`). Null `sort_index` / `z_index` means append; a null path is built from the published parent. It is the only TOC copy column list; full publish no longer has its own loop. `published_at` is a column on that insert (`clock_timestamp()`), not a trigger.

`_publish_units(project_id, stable_ids, full)` applies a set of units: removals deepest first, then copies parents first, then source repointing (§5.6). Both mutations call it. `_unpublish_toc_stable_id` returns the published source copy it detached instead of deleting it, so a layer whose source did not change is repointed at the copy it already had, and its `geostats` are not copied again. Detached copies that no layer uses are deleted at the end.

### 6.2 Pending state per item

One schema addition, not on the changelog: `table_of_contents_items.published_at timestamptz`, set on published rows when they are written (full or partial). Then:

- Added = draft row without a published `stable_id` match.
- Removed = published row without a draft match (bundles via the published parent chain).
- Updated = match whose published copy differs from the draft in anything publish copies: the TOC row (including `parent_stable_id`, `translated_props`, `bounds`, and the derived `data_source_type` and `original_source_upload_available`), the layer (style, source layer, sublayer, render-under), interactivity settings (not the `layers` list, which publish does not copy), ACL type and groups, active data tables, or the source. `sort_index`, `path`, and `z_index` are not compared. Sources are compared column by column, `geostats` included, because XML metadata uploads and the PII backfill change `geostats` alone, and so are their upload outputs, because reporting jobs and PMTiles replacement add outputs to an existing source. `_overlay_changed_stable_ids` and `_publishable_source_differs` hold this comparison and the copy helpers name them in their TODO comments.
- Order is not a pending unit. Sibling-order and z-order differences still keep `draft_table_of_contents_has_changes` true. `Project.overlayOrderPending` exposes that comparison to the modal.

Because pending is structural, an edit that is reverted before publishing is not pending. The blue Publish button still reads the stored `draft_table_of_contents_has_changes` flag: draft edit triggers set it, a `projects` trigger sends `pg_notify` to the admin subscription when it flips, and nothing on the editing path runs the structural comparison. A reverted edit therefore leaves the button blue until the next publish, and the modal says the lists match. After a partial publish the flag is the units left unselected, plus any order difference. After a full publish it is false. The API tests check both against a full recomputation after every publish.

`published_at` is `clock_timestamp()` on the publish insert, not `now()`, so edits made earlier in the same transaction are not still pending after the row is written. There is no insert trigger for it.

`projects_change_logs_since_last_publish` keeps the `last_at > table_of_contents_last_published` range (`-infinity` when the project was never fully published), then drops rows whose item was partial-published after that changelog entry. `projects_comments_since_last_publish` uses the same per-item cutoff. Partial publish does **not** move `table_of_contents_last_published`, so that timestamp stays the last full publish.

No new field groups, and nothing new is written into `from_summary`, `to_summary`, blobs, or `meta`. A partial publish records the existing `layers:published` row exactly as the full publish does.

### 6.3 Mutations

`publish_table_of_contents(project_id)` (full publish):

1. Advisory lock; permission check; set `seasketch.publishing`.
2. Remove every published row of a `stable_id` that has more than one published row (left by concurrent publishes before the lock existed), so the draft item is copied again.
3. Compute all units and apply them with `_publish_units(..., full => true)`: copied items take the draft `sort_index`, `z_index`, and `path`.
4. Write the draft `sort_index` and `path` onto published TOC rows, and the draft `z_index` onto published layers, where they differ. Unchanged rows keep their ids, layers, source copies, and `published_at`.
5. Clear the flag, set `table_of_contents_last_published`, queue one `recordProjectActivity` job, record `layers:published`, and return all published rows.

`publish_table_of_contents_items(project_id, stable_ids text[])`:

1. Advisory lock; permission check; `set_config('seasketch.publishing', 'true', true)` so the per-row triggers listed below return immediately.
2. Compute units and edges (`requires`, `bound`) from the two trees; expand `stable_ids` to the closure.
3. Removed units, deepest `path` first: delete published rows and dependents (§5.3).
4. Added/Updated units, ancestors first: remember the published `sort_index` and `z_index` if the row exists, delete the stale copy, `_publish_copy_draft_toc_item` with those values or null to append.
5. Point the layers written in this run at a published source: reuse a matching copy (§5.6) or copy the draft source with its upload outputs. `bucket_id` and `object_key` are copied because the source insert trigger is not filling them.
6. Rebuild published paths and check reachability (§5.7). Do not renumber `sort_index` or `z_index`.
7. Clear `seasketch.publishing`. Set `draft_table_of_contents_has_changes` (§6.2). Do not change `table_of_contents_last_published`. Queue one `recordProjectActivity` job. Record `layers:published` with `layer_count` = the layers this run published or removed. Return the published rows written.

An empty selection, or one with no pending ids, returns before any of this and records nothing.
8. `publishTilesAclPlugin` rewrites the tiles ACL document for this mutation as well as full publish.

`seasketch.publishing` bails out of: the TOC before-insert validation (published rows only), `table_of_contents_items_project_update`, the data-layer and data-source before triggers, the "draft has changes" triggers on layers, sources, and ACLs, the upload-replacement changelog on `data_source_id`, the TOC insert changelogs, and `record_project_activity_on_delete` (each publish queues that job once instead). `after_deleted__data_upload_outputs` keeps running: it queues the S3 object for cleanup when the last row that references it is deleted, and an index on `data_upload_outputs.remote` keeps that lookup cheap. Full publish sets the same flag for its copy loop and clears it before returning. The backfill of `published_at` sets the flag too, so it does not mark every project unpublished.

### 6.4 Performance

Measured on a synthetic project with 3,000 layers in nested folders and about 82 KB of compressed `geostats` per source (246 MB in total), after `ANALYZE`:

| Operation | Time |
| --- | --- |
| Publish button state (stored flag) | constant |
| Pending list (modal query) | 1.4–2.0 s |
| Partial publish, 1 item | 1.7 s |
| Partial publish, 29 items | 1.8 s |
| Full publish, `master` function, any change | 21–28 s |
| Full publish, nothing changed | 1.5 s |
| Full publish, 20 titles and 10 source attributions changed | 1.6 s |
| Full publish, stacking order of every layer reversed | 1.6 s |
| Full publish, every title changed | 13.9 s |
| Full publish, every source changed | 18.5 s |

Comparing `geostats` takes about 1.2 s of the pending list, because both copies are decompressed; the rest of the comparison is under 0.2 s. Projects of typical size take a fraction of this. A full publish costs that comparison plus the items that changed. Copying an item is dominated by the 16 generated full-text columns on `table_of_contents_items` and by rewriting `geostats`, so a publish that changes every item is still slow, but no longer slower than before.

### 6.5 Known limitation left for a later update

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
- The modal always loads the pending list from the server, and Publish is disabled until it arrives. After a partial publish the cached full-publish review lists are evicted.
- If the server refuses the publish, the modal shows its reason under "Could not publish these changes".
- An Updated row with no changelog pills shows "Other changes".
- With nothing pending, the modal says either that the published list matches the draft, or that only reordering and stacking are left for Publish.

Full publish

- The primary Publish button keeps the existing review panel, now fed by the same per-item pending data, and calls `publish_table_of_contents`.
- When the changelog is empty, the review panel says that changes the changelog does not record may still need publishing. Reorders, untracked edits such as bounds, and a flag left on by a reverted edit all show that message.

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
8. Changed a field with no changelog trigger (bounds, render_under) and nothing else → Updated unit with an "Other changes" pill → §6.2 → one checkbox. Changing it back before publishing removes the row.
9. Edited a source-level field (attribution/temporal) on a shared source → all layers on that source bound → §5.6 → grouped under "Shared source", one checkbox.
10. Edited only the style of one layer sharing a source → single unit → no binding.
11. Data-library layer whose library source was updated → no pending unit → already live.
12. Added/replaced/deleted a data table on a layer → Updated with "Data tables" pill → one checkbox.

Moves

13. Moved a layer into an existing published folder → Updated (moved) → §5.2 → single checkbox; breadcrumb shows the destination; it is appended among that folder's published children.
13a. Moved folder B out of folder A, then moved A into B → `Item(A)` requires `Item(B)` → §5.2 → checking A links B.
13b. Moved a published folder into a new folder and added a layer to it → the layer needs nothing; the moved folder requires the new one → §5.2.
14. Moved a layer into a new folder → requires the Added folder → §5.2 → checking the layer links the folder.
15. Moved a layer into a new folder inside another new folder → requires both, transitively.
16. Created a folder, moved layers in, checked only the folder → folder publishes empty; layers stay where they are publicly → valid.
17. Moved a layer out of folder A, then deleted A → `Removed(A)` requires the layer's Updated unit → §5.3 → checking A links the layer; checking only the layer is fine.
18. Moved a layer from new folder A to new folder B before publishing → requires only B.
19. Moved a folder with contents → one Updated unit on the folder → §5.7 → descendants not listed; their published `path` is rebuilt.
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
39. Partial publish → one `layers:published` row with the existing shape, counting the layers it published; per-layer history may over-attribute it (§6.5).
40. Full publish → the published list matches the draft, including reorders, stacking, and untracked field changes. Only differing items are copied; unchanged published rows keep their ids and source copies.

## 9. Open questions

- Resolved: partial publish does not ship `sort_index` or `z_index`. Full publish does.
- Published reports referencing layers: should publishing a Removed layer check published report cards, or is a dangling reference acceptable?
- Resolved: the pending computation lives in SQL and is shared by the modal query, the mutation's closure, and the flag.
