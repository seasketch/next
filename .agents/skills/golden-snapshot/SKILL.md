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

The golden snapshot is the database base for dev machine installs, CI bootstrapping, integration tests, and agent-driven development. Migrations do not create its fixtures. Those are references to public data layers (EEZs, OSM land, data-library tilesets), default basemaps, geography settings, and example projects such as `demo-samoa`, which are there for interactive testing and may be reused in smoke tests.

`npm run setup` restores `packages/api/snapshots/golden.dump`, then applies committed migrations newer than that dump. The dump is gitignored. `npm run snapshot:publish` uploads it to R2 at `golden-snapshot/current/`. Until that upload, dev machines, CI, and agents keep booting from the previous fixtures.

The dump is built from committed migrations, the graphile-worker schema, and three seed files:

- `packages/api/snapshots/fixtures.sql` — `e2e|member`, `e2e|admin`, public project `demo-samoa`, default basemaps, Samoan (`sm`)
- `packages/api/snapshots/data-library.sql` — hardcoded superuser templates: `SEAMOUNTS`, `DAYLIGHT_COASTLINE`, `MARINE_REGIONS_EEZ_LAND_JOINED`, `MARINE_REGIONS_TERRITORIAL_SEA`
- `packages/api/snapshots/geographies.sql` — clones those geography templates into `demo-samoa` the same way create-project does (Samoa `MRGID_EEZ` 8445, offshore and nearshore)

`packages/api/scripts/snapshot-create.sh` checks the result: those four template ids, 6 clipping layers, 3 published overlay layers, region xmin `-174.5`, and Samoan enabled.

## When to update the seed

Update the seed in the same change, then rebuild and publish, when:

- Create-project's geography, basemap, or language steps change. `demo-samoa` is the example project those installs and smoke tests open, so it stays on the same path: `geographies.sql` calls `copy_data_library_template_item`, filters styles, nests with `nest_new_project_geography_draft_toc_under_folder`, publishes, and calls `set_project_region_bounds`. `fixtures.sql` calls `add_default_basemaps` and `toggle_language_support`.
- The client starts requiring a different geography template id or data-source shape. `GeographyAdmin` waits until coastline, EEZ, and territorial-sea sources have URLs.
- A column, check, or trigger on a table the seed inserts into rejects the current inserts. Those tables include `projects`, `table_of_contents_items`, `data_layers`, `data_sources`, `interactivity_settings`, `project_geography`, and `geography_clipping_layers`.
- A hardcoded library layer is added or its public URL, `source_layer`, cartography, or template id changes. Primarily this applies to the SEAMOUNTS data-library layer, as other layers have not been added to the snapshot for simplicity (and should probably stay that way).

Keep `SHARED_DATA_LIBRARY_TEMPLATE_IDS` in `packages/api/tasks/cleanupDeletedOverlayRecords.ts` equal to the template ids in `data-library.sql`. Outside production, that worker skips R2 deletes for outputs whose source still carries one of those ids. Production still deletes its own unused objects.

## What the seed must not contain

- `data_upload_outputs` rows, and any production `remote` (`r2://` or `s3://`). Layers point at public `tiles.seasketch.org` URLs only.
- The rest of the production data-library catalog, Coral Reef Watch, or historical output versions.
- An iNaturalist layer. The data-library modal creates one when someone asks for it.
- A Google Maps tile session. Sessions expire. `packages/api/scripts/setup.sh` queues `refreshGmapsApiSession` when none is valid.
- A signing key (`jwks` rows). Every install restored from the dump would share it. `snapshot-create.sh` fails if the source has one and dumps `jwks` without data; `setup.sh` generates a key per database after restore. Do not commit `golden.dump`.

## When a rebuild is unnecessary

`npm run setup` migrates forward after restore. Committing a migration that the seed does not run, and that does not change `demo-samoa` or the library templates, does not need a new dump.

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
