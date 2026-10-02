---
name: golden-snapshot
description: >
  Keep the SeaSketch golden snapshot in sync. It is the database base for dev
  installs, CI, integration tests, and agent-driven development, and it holds
  fixtures migrations do not create: public data layers (EEZs, OSM land,
  data-library tilesets), default basemaps, geography settings, and example
  projects such as demo-samoa. Use when editing packages/api/snapshots
  (fixtures.sql, data-library.sql, geographies.sql), create-project geographies,
  basemaps, supported languages, data-library template ids, or
  cleanupDeletedOverlayRecords shared template ids. Also use when a migration
  changes inserts the snapshot seed runs, or when snapshot:create fails.
---

# Golden snapshot

The golden snapshot is the database base for dev machine installs, CI bootstrapping, integration tests, and agent-driven development. Migration vs. fixture rules: [packages/api/snapshots/README.md](../../../packages/api/snapshots/README.md). Migrations do not create its fixtures. Those are references to public data layers (EEZs, OSM land, data-library tilesets), default basemaps, geography settings, and example projects such as `demo-samoa`, which are there for interactive testing and may be reused in smoke tests.

`npm run setup` restores `packages/api/snapshots/golden.dump`, then applies committed migrations newer than that dump. The dump is gitignored. `npm run snapshot:publish` uploads it to R2 at `golden-snapshot/current/`. Until that upload, dev machines, CI, and agents keep booting from the previous fixtures.

The dump is built from committed migrations, the graphile-worker schema, and three seed files:

- `packages/api/snapshots/fixtures.sql` — accounts and projects that installs and smoke tests open. A participant has to be in the state the UI requires, not merely present in the table.
- `packages/api/snapshots/data-library.sql` — the small set of public templates the other seed files clone, each with its production `data_upload_outputs`. Overlay analysis, geography clipping, and downloads read those rows (the FlatGeobuf output in particular), not the tile URL, so a template without them looks fine on the map and fails everywhere else. It is not the production catalog.
- `packages/api/snapshots/geographies.sql` — builds the example project's geographies the same way create-project does, from those templates.

`packages/api/scripts/snapshot-create.sh` rebuilds a side database from that seed and refuses to write the dump when the result would break an install or a smoke test. The checks live in the script. Add one there when a new seed fact matters. Do not copy the list into this skill.

## When to update the seed

Update the seed in the same change, then rebuild and publish, when:

- Create-project's geography, basemap, or language steps change. `demo-samoa` is the example project those installs and smoke tests open, so it stays on the same path: `geographies.sql` calls `copy_data_library_template_item`, filters styles, nests with `nest_new_project_geography_draft_toc_under_folder`, publishes, and calls `set_project_region_bounds`. `fixtures.sql` creates every fixture project through `create_project` as `e2e|admin`, so a new step in that function reaches the fixtures on the next rebuild. Do not insert `projects` rows directly.
- The client starts requiring a different geography template id or data-source shape. `GeographyAdmin` waits until coastline, EEZ, and territorial-sea sources have URLs.
- A column, check, or trigger on a table the seed inserts into rejects the current inserts. Those tables include `projects`, `table_of_contents_items`, `data_layers`, `data_sources`, `interactivity_settings`, `project_geography`, and `geography_clipping_layers`.
- A hardcoded library layer is added or its public URL, `source_layer`, cartography, or template id changes. Primarily this applies to the SEAMOUNTS data-library layer, as other layers have not been added to the snapshot for simplicity (and should probably stay that way).

The template ids `data-library.sql` inserts are listed once, in `packages/api/src/DataLibrary/snapshotTemplateIds.js`. `snapshot-create.sh` fails when the seed inserts a different set. `cleanupDeletedOverlayRecords` reads the same list: outside production it skips R2 deletes for outputs whose source still carries one of those ids. Production still deletes its own unused objects.

## What the seed must not contain

- Outputs for anything outside the `superuser` project. Seeded outputs carry production `remote` keys, and a developer's R2 credentials can delete those objects. Outside production, `cleanupDeletedOverlayRecords` never deletes an object whose output belongs to `superuser`, even after its data source is gone. That guard is the only thing protecting them, so copy outputs from production verbatim onto `superuser` templates and nowhere else.
- The rest of the production data-library catalog, Coral Reef Watch, or historical output versions.
- An iNaturalist layer. The data-library modal creates one when someone asks for it.
- Graphile-worker jobs. `snapshot-create.sh` fails if the source has any. Work a fresh install needs is queued by `packages/api/scripts/setup.sh` after restore: `refreshGmapsApiSession` when no tile session is valid (sessions expire), and the geography size metrics `createProjectWithGeographies` pre-warms.
- A signing key (`jwks` rows). Every install restored from the dump would share it. `snapshot-create.sh` fails if the source has one and dumps `jwks` without data; `setup.sh` generates a key per database after restore. Do not commit `golden.dump`.

## When a rebuild is unnecessary

`npm run setup` migrates forward after restore. Committing a migration that the seed does not run, and that does not change `demo-samoa` or the library templates, does not need a new dump.

One exception: a migration that changes a function a stored generated column calls, including its `search_path`. `pg_restore` evaluates those columns while loading rows, before `setup` migrates forward, so the dump itself has to contain the new definition. Migration `000446` sets `search_path` on `changelog_row_net_zero_changes`, both `create_bbox` overloads, `generate_export_id`, `generate_label`, and `toc_to_tsvector`. `CREATE OR REPLACE` drops that setting, and `snapshot-create` refuses a dump where any of them is missing it.

`current.sql` is excluded. `snapshot-create` runs `db:migrate`, which applies committed files only.

## Rebuild and publish

From the repo root. Postgres must already have a database named `seasketch` (migration `000055.sql` grants on that name). `snapshot:create` builds side database `seasketch_snapshot_src` and does not modify `seasketch`.

```bash
npm run snapshot:create
npm run snapshot:publish
```

`snapshot:publish` reads R2 credentials from `packages/api/.env` and archives the previous object under `golden-snapshot/archive/`.

`npm run setup -- --reset` replaces the local `seasketch` database and drops connections to it. Run that only when this machine should move onto the new dump. Setup also deletes Redis keys `userid-by-sub:*`. Those keys have no expiry, and a restored database issues new user ids.

If `snapshot:create` fails, fix the seed or the migration it tripped over and run it again. Do not hand-edit `golden.dump` or `golden.manifest.json`.

After a change to the orphan-delete SQL in `cleanupDeletedOverlayRecords.ts`, run `packages/api/tests/dataLibraryLiveUpdates.test.ts`. That suite covers shared library sources. It does not call R2.
