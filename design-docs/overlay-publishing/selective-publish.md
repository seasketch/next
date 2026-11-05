# Selective Overlay Publishing

Admins edit a draft overlay list and publish it to end users. Today `publish_table_of_contents` replaces the whole published tree with a copy of the whole draft tree. The goal of this work is to let an admin publish **a subset of the pending changes** from the "Selective publish" modal (header split button, checkbox list), leaving everything else exactly as it is on the public map.

Partners rejected "freeze/pause" and per-item context-menu publishing. This document describes the semantics, hard constraints, dependency rules, UI behavior, and backend changes needed to make the checkbox modal coherent and data-safe.

Related: [Selective Overlay Publishing plan](../../.cursor/plans/selective_overlay_publishing_d3877543.plan.md) · mock UI in `packages/client/src/admin/data/MockSelectivePublishModal.tsx`.

## 1. Goals and non-goals

Goals

- An admin can publish any valid subset of pending overlay-list changes. Unselected published items keep their current public state; unselected new items stay unpublished.
- The published tree is always structurally valid after every publish (no orphans, unique stable ids, correct paths, deterministic ordering).
- What a checkbox will do is legible from the list itself, without warning banners.
- Pending changes are computed from data, not from timestamps, so they remain correct after any number of partial publishes and with multiple editors.

Non-goals

- Publishing a *past* state of an item (rollback). Publishing always means "publish the current draft state of X".
- Publishing individual field edits of one item (e.g. only the title but not the cartography). See §3.
- Pausing or excluding layers from future full publishes.

## 2. How publishing works today (facts the design depends on)

| Fact | Where | Consequence for selective publish |
| --- | --- | --- |
| Draft and published rows live in one table, split by `is_draft`. `id` changes on publish; `stable_id` is the identity shared by a draft row and its published counterpart. | `table_of_contents_items` | All matching between draft and published must be by `(project_id, stable_id)`. |
| `path` is an ltree of ancestor stable ids; `parent_stable_id` names the parent. Path is computed on insert from the parent's path. | `before_insert_or_update_table_of_contents_items_trigger` | A published item's `path` must be derived from the **published** parent chain at publish time, never copied from draft, because draft and published ancestors can differ. |
| `sort_index` is **per sibling group** (0..n-1 within a parent, rewritten by `update_table_of_contents_item_children`). Reorders inside the same parent record **no changelog**; only `parent_stable_id` changes record `layer:parent-changed`. | `update_table_of_contents_item_*`, `trg_changelog_table_of_contents_items_parent_changed` | Sibling order is folder-level state and is currently invisible to the changelog. It needs its own representation (§5.4). |
| `data_layers.z_index` is a project-wide stacking order, rewritten for every layer by `update_z_indexes`, recorded as one project-level `layers:z-order-change` row. | `update_z_indexes` | Z-order is a project-level change, not a per-layer one (§5.5). |
| Deleting a folder deletes its whole subtree, one row at a time, firing a `layer:deleted` / `folder:deleted` row **per item** with `from_summary = {title, is_folder}` and `from_blob = {data_layer_id, data_source_id, url}`. | `delete_table_of_contents_branch`, `_delete_table_of_contents_item`, `trg_changelog_table_of_contents_items_deleted` | After deletion the only trace of the item is the published row (if any) and the changelog row keyed by the *old draft id*. Neither records `stable_id` or parent today. |
| Deleting a draft layer whose `stable_id` is referenced by a report card is refused. | `_delete_table_of_contents_item` | Report references are enforced at edit time, not publish time. |
| Published rows are immutable (`Cannot alter table of contents items after they are published`). | `before_insert_or_update_table_of_contents_items_trigger` | Publishing a changed item is delete-and-recopy of its published rows, never an update. The trigger needs a bypass setting for the path/sort rewrites described in §6. |
| Publish copies, per layer: `interactivity_settings`, `data_layers`, ACL type + groups, active `overlay_data_tables` (matched by TOC `stable_id`, table `stable_id` preserved), and one copy of each non-library `data_source`, repointing published layers at it. Data-library sources are shared, not copied. Column lists are hard-coded. | `publish_table_of_contents` | A layer's "state" is the union of all of these rows. The per-item copy must be factored into a reusable helper so full and partial publish share one column list. |
| `data_sources.attribution` and `temporal` changes record a changelog row on **every** draft layer using that source. | `trg_changelog_data_sources_*_for_toc` | Source-level edits are shared state across layers (§5.6). |
| After the mutation, the API rewrites the project's hosted-tiles ACL document from the published tree. | `publishTilesAclPlugin.ts` | Must run after every publish, full or partial. |
| "Changes since last publish" = changelog rows with `last_at > projects.table_of_contents_last_published`. Membership of past publishes is inferred from time windows. | `projects_change_logs_since_last_publish`, `table_of_contents_items_related_publish_change_logs` | A single project timestamp cannot describe a partially published project. Replaced in §6.2. |

## 3. Core model: the unit of publication is an item's current state

The checkbox list is rendered from changelog rows, but **what is published is never a changelog row**. The unit of publication is:

- **Item unit** `Item(stable_id)` — publish the complete current draft state of one layer or folder (TOC row, data layer, source, interactivity, ACL, data tables), or remove its published copy if it no longer exists in draft. One item has exactly one unit, which is one of:
  - **Added** — draft row exists, no published row.
  - **Updated** — both exist and differ (any difference, including a move).
  - **Removed** — published row exists, no draft row.
- **Order unit** `Order(parent)` — the sibling order of one folder's children, or of the root list.
- **Z-order unit** `ZOrder` — the project-wide `z_index` ordering.

Consequences, which answer the first two notes in the brief:

1. Selecting a layer publishes *all* of its edits. The pills on its row (title, cartography, metadata, …) are an explanation, not individually selectable.
2. A Removed item publishes only the removal. Its earlier edits are moot; the list does not show them.
3. An item created and deleted since the last publish has no unit at all. It appears in history only.
4. An item deleted in draft and re-created with the same title gets a new `stable_id`, so it appears as one Removed unit and one independent Added unit.

Only full publish is "everything selected". There is one engine; full publish is the degenerate case.

## 4. Change types and which unit they belong to

| Changelog field group | Unit | Notes |
| --- | --- | --- |
| `layer:title`, `layer:metadata`, `layer:attribution`, `layer:cartography`, `layer:downloadable`, `layer:acl`, `layer:interactivity`, `layer:temporal`, `layer:uploaded` (source replaced), `layer:parent-changed` | `Item(layer)` Updated/Added | Pills on the row. |
| `folder:title`, `folder:acl`, `folder:type` (click-off / radio / hide children), `layer:parent-changed` on a folder | `Item(folder)` Updated/Added | Folder ACL and type changes affect how descendants display and who can see them, but they are folder state; descendants are not modified. |
| `folder:created`, `layer:uploaded` on a brand-new layer, `data_source.created_at > published_at` | `Item` Added | |
| `layer:deleted`, `folder:deleted` | `Item` Removed | One row per deleted item, including every descendant of a deleted folder. |
| `data_table:*` | `Item(layer)` Updated | Data tables belong to the layer via `table_of_contents_item_id`; published copies are matched by `stable_id`. |
| `layers:z-order-change` | `ZOrder` | Project-level. |
| *(none today)* sibling reorder | `Order(parent)` | New field group `folder:children-reordered` (§5.4). |
| `resolvable_layer_comments:*` | none | Comments are workflow, not published state. They are shown in the full-publish review as context but are never a checkbox. |
| Changes with no trigger (`bounds`, `render_under`, `source_layer`, `sublayer`, `geoprocessing_reference_id`, …) | `Item` Updated with a generic "Other settings" pill | Detection must not rely on the changelog (§6.2). |

## 5. Hard constraints vs. UI conveniences

A **hard constraint** is something the server must enforce or the published tree becomes invalid or incoherent. A **convenience** is something the UI does so the admin does not have to think about the constraint. The server always recomputes the closure of a selection and rejects (or expands, see §6.3) anything that violates a hard constraint, so the UI bindings are never the only line of defense.

### 5.1 Atomic item state (hard)

An item is published whole. Partial field publication is impossible because the published copy is produced by copying the current draft rows.

### 5.2 Parent must exist in the target tree (hard)

Define the **target tree** as: the published tree, minus selected Removed units, plus the draft state of selected Added/Updated units.

Rule: every item in the target tree must have its draft `parent_stable_id` present in the target tree (or be at root).

- Added item whose draft parent is an Added folder ⇒ **requires** `Item(parent)`. Transitively for nested new folders.
- Updated item that was moved into an Added folder ⇒ **requires** `Item(parent)`.
- Updated item moved into a *published* folder ⇒ no dependency. The folder being Updated (renamed, moved, re-ACL'd) is irrelevant; the child just needs the folder to exist.
- An item can never be moved into a Removed folder in draft (the folder no longer exists in draft), so that conflict cannot occur.

Convenience: checking the child auto-checks the required parent folder(s) and shows them as linked (§7).

### 5.3 Removing a folder empties it (hard)

Rule: a published folder may be removed only if, after the publish, no item in the target tree has it as an ancestor.

Each published descendant D of a Removed folder F is in one of two states in draft:

- D was deleted too (the normal case; `delete_table_of_contents_branch` deletes the subtree) ⇒ D is its own Removed unit. `Item(F)` and `Item(D)` are **bound** into one bundle: selecting the folder's removal selects all of them, and they are presented as one row with a nested count (§7).
- D was moved out of F before F was deleted ⇒ `Item(D)` is Updated (moved). `Item(F)` Removed **requires** `Item(D)`. Otherwise D would be orphaned in the published tree.

### 5.4 Sibling order is folder-level state (hard constraint on determinism, UI choice on ownership)

Problem: `sort_index` is rewritten for all siblings; reorders are not changelogged; a partial selection can introduce new siblings into a published folder whose other children are not being published.

Design:

1. Record reorders. `update_table_of_contents_item_children` (and `_position`) compare the old and new `stable_id` sequence of the affected parent; when it differs, record one changelog row `folder:children-reordered` with entity = the parent folder TOC id (or `projects`/project id for root), `from_blob`/`to_blob` = ordered `stable_id[]`. Coalescing window: 5 minutes (people fiddle).
2. Expose it as an **Order unit** in the modal under "Other": "Order of items in *Habitats*" / "Overlay list order". It is independent of the item units.
3. Publish-time placement algorithm for a parent P, given the set of children in the target tree:
   - If `Order(P)` is selected: children of P in the target tree are ordered by their draft `sort_index`. Children that exist in the target tree but not in draft (unselected Removed items) stay in place relative to their published neighbours (stable merge, below).
   - If `Order(P)` is not selected: unselected published children keep their published relative order. Each selected Added/moved-in child is inserted **immediately after the nearest preceding draft sibling that is present in the target tree** (or first if none). This is deterministic, never reorders unselected items, and puts new items where the admin sees them in the draft list whenever the neighbourhood matches.
   - In both cases `sort_index` is then renumbered 0..n-1 on the published rows. Because published rows are immutable, this write (like the `path` rewrite in 5.7) runs under a dedicated `seasketch.publishing` session setting that the immutability trigger honours.
4. `Order(P)` is pending whenever the published sibling order (restricted to items that exist in both trees) differs from the draft order. This is computed, not inferred from the changelog (§6.2).

The alternative — treat sibling order as owned by the folder and always publish the draft order whenever anything in that folder publishes — is simpler but silently moves unselected items. Rejected.

### 5.5 Z-order is a project-level unit (hard: never leave a new layer without a defined z)

- `ZOrder` pending ⇔ some layer that exists in both trees has `draft.z_index ≠ published.z_index`.
- Selected: copy draft `z_index` onto every published `data_layers` row whose stable id exists in draft (all of them, including unselected items — z-order is not item state).
- Not selected: unselected layers keep their published `z_index`. Newly published Added/Updated layers take their draft `z_index` (they are copied whole). Ties or interleavings with stale values are harmless because the client only needs a total order; the `ZOrder` unit remains pending so the admin can reconcile later.
- UI: a single row under "Other": "Layer stacking order (N layers reordered)".

### 5.6 Shared data sources (hard for coherence, cheap to enforce)

Several draft layers can share one `data_source` (ArcGIS services, multi-layer vector tiles, exploded uploads). Source-level fields (`attribution`, `temporal`, and the source row itself after a replace) are copied once per publish and all published layers from that source point at the copy.

Rule: if any source-level change is pending on source S, all Item units for layers using S are **bound** into one bundle. Otherwise two published copies of S with different attributions would coexist and the map would display both.

Layer-only changes (style, title, metadata, interactivity, ACL) on layers sharing a source do not bind.

Data-library layers: sources are shared and never copied (`data_library_template_id is not null`), so library-source edits are already live and never appear as pending.

### 5.7 Moving a folder moves its subtree (hard, but no selection dependency)

Moving folder G changes `parent_stable_id` on G only; descendants' `parent_stable_id` is unchanged, only their `path` changes. Publishing `Item(G)` therefore:

- requires nothing from descendants,
- but must rewrite `path` on every published descendant of G (selected or not) to the new ancestor chain. This is a derived-column maintenance step, not a state change, so descendants do not show as Updated.

Likewise, publishing an Added/Updated item recomputes its `path` from the published parent chain, and publishing a Removed folder removes its (bound/required-to-be-gone) descendants.

### 5.8 Folder ACL and behaviour inherit (not a constraint)

`_session_has_toc_access` evaluates ACLs along `path`, and radio/hide-children behaviour is read from the parent at render time. Publishing a folder's ACL/type change immediately affects published descendants without touching their rows. This is correct and needs no binding; the UI should simply describe the pill as "Access (applies to contents)".

### 5.9 Concurrency (hard)

- Every publish takes `pg_advisory_xact_lock(hashtext('publish_toc:' || project_id))`.
- The selection is resolved against the draft state at publish time. If an editor changes an item between the modal opening and the publish, the latest draft state of selected items is what ships (consistent with §3). The server returns the manifest so the client can show what actually went out.
- Two editors' edits to the same item are one unit; there is no per-editor publishing.

### 5.10 Things that are blocked at edit time, not publish time

- Deleting a draft layer referenced by a report card is refused. (Open question in §9 about published reports referencing a layer whose removal is published.)
- `is_folder` cannot change; a layer cannot become a folder, so there is never an Updated unit that changes kind.

## 6. Backend design

### 6.1 Reusable per-item copy

Extract the body of the per-item loop in `publish_table_of_contents` into `_publish_copy_toc_item(draft_id, published_parent_path ltree, sort_index int) returns int` covering interactivity settings, `data_layers`, the TOC row (path computed from the published parent), ACL type + groups, and the item's active `overlay_data_tables`. Source copying stays a separate pass keyed by source (`_publish_copy_data_source(source_id, project_id)`), repointing only the published layers created in this run plus any published layers that already point at an older copy of the same draft source when the source unit is bound (§5.6). The hard-coded column lists then live in one place, satisfying the AGENTS.md rule for `publish_table_of_contents` / `copy_table_of_contents_item`.

### 6.2 Pending state is a diff, not a timestamp

Add to `table_of_contents_items`:

- `draft_revision bigint` on draft rows, bumped by triggers whenever the item's state changes: the TOC row itself, its `data_layers` row, its `interactivity_settings`, its ACL (type or groups), its non-library `data_sources` row, and its active `overlay_data_tables`. The existing `*_draft_toc_has_changes` triggers already locate the TOC item for most of these and can bump the counter in the same statement.
- `published_revision bigint`, `published_at timestamptz`, `publication_run_id` on published rows, copied from the draft at publish time.

Then, for a project:

- Added = draft row without a published `stable_id` match.
- Removed = published row without a draft match.
- Updated = match where `draft_revision > published_revision`.
- `Order(P)` pending = ordered stable ids of common children differ.
- `ZOrder` pending = any common layer with differing `z_index`.

Changelog rows are attached as the **narrative** for each unit: rows with `entity_id = draft id` and `last_at > published_at` (or all rows for Added). For Removed units, the `layer:deleted` row is found through the published row: extend `trg_changelog_table_of_contents_items_deleted` to put `stable_id` and `parent_stable_id` into `from_blob` so Removed units can be matched, titled, and nested under their folder without a draft row. Units that differ but have no changelog rows get the generic "Other settings" pill. Comment rows attach by item for context only.

`projects.table_of_contents_last_published` stays as "time of the last publish run" for display. `draft_table_of_contents_has_changes` becomes `exists(pending unit)`, recomputed at the end of each publish.

A new query `projectBySlug.pendingPublishUnits` (PostGraphile computed column or plugin) returns the units with kind, title, path, pills, dependency edges (§6.3), and a `canPublishAlone` flag, replacing `changeLogsSinceLastPublish` as the data source for both the full review panel and the selective modal.

### 6.3 Dependency closure on the server

`publish_table_of_contents(project_id, selection jsonb default null)` where `selection = { items: stable_id[], orders: stable_id[] (parent stable ids, '' for root), zOrder: boolean }`. `null` means everything.

Steps inside one transaction:

1. Advisory lock; permission check.
2. Compute units and dependency edges (`requires`, `bound`). Expand the selection to its closure. If the expansion added units the client did not send, the mutation still proceeds (the UI already presents them as linked; the server behaves identically) and the manifest lists them as `included_by_dependency`. Selecting a unit that is not pending is a no-op.
3. Apply Removed units: delete published TOC rows (and their data layers, interactivity, ACLs, data tables by FK cascade; sources only if no remaining published layer references them). Order: deepest path first.
4. Apply Added/Updated units in ancestor-first order: delete the stale published copy (if any), `_publish_copy_toc_item` with path from the published parent, provisional `sort_index`.
5. Copy sources for the layers published in this run; repoint.
6. Recompute `sort_index` for every parent that gained, lost, or reordered children per §5.4; rewrite `path` for descendants of moved folders per §5.7; apply `ZOrder` if selected. These writes run with `set local seasketch.publishing = 'true'`, which the immutability trigger treats like the existing `skip_library_source_side_effects` bypass.
7. Insert a `publication_runs` row (`id`, `project_id`, `editor_id`, `mode full|partial`, counts) and `publication_run_items` rows (`run_id`, `stable_id`, `kind added|updated|removed|order|z-order`, `included_by_dependency`). Stamp `publication_run_id` / `published_at` / `published_revision` on the new published rows.
8. Recompute `draft_table_of_contents_has_changes`; set `table_of_contents_last_published = now()`; record one `layers:published` changelog row with `{mode, run_id, added, updated, removed}`.
9. `publishTilesAclPlugin` rewrites the tiles ACL document as today.

`table_of_contents_items_related_publish_change_logs` switches from time-window inference to `publication_run_items` membership. Per-layer history gets a real "Published (partial)" event with the run's counts.

### 6.4 Rejected alternative: per-layer `publish_table_of_contents_item`

Publishing items one at a time outside a single transaction cannot honour §5.2/§5.3 atomically and produces N tiles-ACL rewrites. One mutation, one closure, one transaction.

## 7. UI behaviour

The modal keeps the shape of the mock (title, explanatory sentence, grouped checkbox sections, "Publish N selected"). Rows are **units**, not changelog rows. Section membership is by unit kind: Added, Updated, Removed, Other (order and stacking units).

Row anatomy

- Checkbox, item icon, title, pills (reusing the summarized-change pills), editor avatars, and a muted breadcrumb of the draft path (`Habitats › Benthic`). A breadcrumb segment that is itself an Added folder renders as a small pill so the dependency is visible before any click.
- Removed folders render with a disclosure: "Benthic habitats *and 12 items inside*". The nested rows are listed indented and dimmed with no checkbox of their own (they are bound, §5.3). Bound shared-source layers (§5.6) are grouped the same way under a "Shared source" header.

Selection mechanics (the "bind, don't warn" rule)

- Selections are tracked as *explicit* (clicked by the admin) or *implied* (added by closure). Checking a unit adds its closure as implied.
- Implied rows render **checked with a link glyph** instead of a plain check (Radix `Link2Icon` inside the checkbox), and a one-line muted caption: "Included with *Coral cover 2024*" naming the first dependent. Hovering or focusing either row highlights the pair with a subtle shared background so the chain is discoverable without text.
- Clicking an implied row toggles it to explicit (it stays checked); it cannot be unchecked while a dependent is explicit. The click produces a short "nudge" animation on the dependents instead of a tooltip or alert; a tooltip on hover (`aria-describedby`) carries the same sentence for assistive tech.
- Unchecking an explicit row removes implied rows that no remaining explicit row needs.
- Unchecking a *required* explicit row (e.g. the new folder) when dependents are explicitly checked is allowed and cascades: dependents are unchecked and briefly highlighted. This is the only cascading-uncheck case and it is the admin's own action, so no confirmation.
- Section "select all" selects explicit for the section and runs closure as usual; if closure reaches into another section, those rows show as implied there.
- Footer: "Publish 4 selected" with a muted suffix "+ 2 included" when implied rows exist. The button label is the total.
- Order rows under Other carry a caption describing the alternative: when `Order(P)` is unchecked and an Added/moved child of P is selected, the row shows "New items are placed beside their draft neighbours". When it is checked: "Items in *Habitats* will take their draft order".
- The stacking row describes its scope: "Layer stacking order · 7 layers".

After publishing

- Modal closes; a toast reports the run ("Published 6 changes") with an "Undo" affordance out of scope but a "View" link to the project history filtered to the run.
- Remaining pending units stay in the list; `draft_table_of_contents_has_changes` keeps the header indicator on.
- The per-layer history shows "Published (partial) — with 5 other changes".

Full publish

- The primary Publish button opens the existing review panel, now backed by the same `pendingPublishUnits` query, and calls the mutation with `selection = null`. Nothing else changes for admins who never use selective publish.

## 8. Scenario catalog

Each row: what the admin did → the unit(s) → hard rule → what the UI does.

Layers

1. Edited title, metadata, and style of a published layer → one Updated unit with three pills → §5.1 → one checkbox.
2. Edited a layer, then deleted it → one Removed unit → §3 → row shows the old title (from `from_summary`), no pills.
3. Created a layer, then deleted it → no unit → §3 → absent from the list; visible in history only.
4. Uploaded a new layer and styled it → one Added unit → §5.1 → one checkbox.
5. Replaced a layer's source (`layer:uploaded`) and restyled → one Updated unit → §5.1 → one checkbox; the old published source copy is dropped when no published layer references it.
6. Duplicated a layer → Added unit with a fresh `stable_id` → independent.
7. Toggled downloads / interactivity / temporal settings → Updated pills; nothing special.
8. Changed a field with no changelog trigger (bounds, render_under, source layer) → Updated with "Other settings" pill → §6.2 → still selectable; honest about unknown detail.
9. Edited a layer that shares its source with another layer, source-level field (attribution/temporal) → both Updated units bound → §5.6 → grouped under "Shared source", one checkbox.
10. Edited only the style of one layer sharing a source → single unit → no binding.
11. Data-library layer whose library source was updated → no pending unit → §5.6 → nothing to publish (already live).
12. Added/replaced/deleted a data table on a layer → Updated unit with "Data tables" pill → §4 → one checkbox.

Moves

13. Moved a layer into an existing published folder → Updated (moved) → §5.2 no dependency → single checkbox; breadcrumb shows the destination.
14. Moved a layer into a new folder → Updated requires Added folder → §5.2 → checking the layer links the folder.
15. Moved a layer into a new folder inside another new folder → requires both folders transitively → §5.2 → both linked.
16. Created a new folder and moved several layers into it; admin checks only the folder → folder publishes empty; layers stay in their published location → valid; nothing is implied upward.
17. Moved a layer out of folder A into folder B, then deleted A → layer's Updated unit is required by `Removed(A)` → §5.3 → checking A links the layer; checking only the layer is fine.
18. Moved a layer from new folder A to new folder B before publishing → requires only B → §5.2.
19. Moved a folder with contents → one Updated unit on the folder → §5.7 → descendants not listed; their published `path` is rewritten on publish.
20. Moved a folder *and* edited a child → two independent units → fine in any combination (child path derives from wherever the folder is in the target tree).

Folders

21. Deleted a folder with its contents → Removed(folder) bound with Removed(each descendant) → §5.3 → one row with "and N items inside".
22. Deleted a folder after moving some contents out and deleting the rest → bound with the deleted ones, requires the moved ones → §5.3 → row shows nested removed items plus linked moved rows in Updated.
23. Renamed a folder → Updated → no dependency.
24. Changed folder ACL → Updated with "Access (applies to contents)" → §5.8 → no dependency; descendants' visibility changes on publish.
25. Changed folder behaviour (radio children, hide children, click-off only) → Updated → §5.8 → no dependency.
26. Created an empty folder → Added → publishable alone.
27. New folder with a new child; admin checks only the child → folder implied → §5.2.
28. Published folder whose only pending change is that children were reordered → `Order(folder)` unit only → §5.4 → appears under Other.

Ordering

29. Reordered root items, nothing else → `Order(root)` → §5.4 → "Overlay list order".
30. Added a layer and also reordered its siblings; admin checks only the layer → inserted beside its draft neighbour, siblings untouched → §5.4 rule 3 → caption explains placement.
31. Admin checks the Order unit and the new layer → draft order applied to all present children.
32. Admin checks the Order unit but *not* the new layer → draft order applied to existing children; new layer still unpublished → valid.
33. Changed z-order only → `ZOrder` unit → §5.5 → "Layer stacking order".
34. Added layers without checking `ZOrder` → new layers get their draft `z_index`; `ZOrder` remains pending if any existing layer differs.

Multi-editor and timing

35. Editor A edits layer X; editor B edits layer Y; A publishes only X → Y stays pending with B's avatar → §6.2.
36. Editor A opens the modal; B edits X before A clicks publish → X ships in its latest state; manifest reflects it → §5.9.
37. Two admins publish concurrently → serialized by the advisory lock; the second run recomputes pending units and may publish nothing for already-published selections.
38. Admin publishes the same partial selection twice → second run is a no-op for those items.

Cross-cutting

39. Any publish → tiles ACL document rewritten from the resulting published tree.
40. Published item has `published_revision`, `published_at`, `publication_run_id`; history for that layer shows the run as "Published (partial)" with counts via `publication_run_items`.
41. Project-level history shows one `layers:published` row per run with `mode`.
42. Full publish → same engine, all units, `mode = full`.

## 9. Open questions

- Published reports referencing layers: edit-time protection only covers draft deletion. Should publishing a Removed layer also check published report cards (if reports gain draft/published states), or is a dangling reference acceptable for reports?
- Should `ZOrder` be auto-included whenever any Added layer is selected, to avoid stale interleavings? Current recommendation is no (keeps the project-level unit honest), but partners may prefer the implied link.
- The 5-minute coalescing window for `folder:children-reordered` — long enough for drag sessions, short enough to attribute to the right publish? Pending state does not depend on it (§6.2), only the narrative does.
- Whether `pendingPublishUnits` should be served by a PostGraphile computed function or a plugin; the dependency-edge computation is easier in TypeScript, but the server-side closure in the mutation must be SQL anyway, so one SQL implementation shared by both is preferred.
