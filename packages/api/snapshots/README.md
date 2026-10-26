# Migrations vs. snapshot fixtures

Rule: a row goes in a migration if every database, including production, must have it. It goes in a fixture if production must not have it. It goes in neither if it is per-database or expires.

## Migrations (`migrations/`)

- Schema.
- Reference rows the code looks up by fixed id: `seasketch|root`, the `superuser` project, `form_element_types`, sketch-class templates.
- Must not reference fixtures (`demo-*`, `e2e|*`) or an environment.
- Data migrations must also succeed against the restored snapshot.

## Fixtures (`snapshots/*.sql`)

- Example projects, synthetic users, memberships, example content. `demo-maldives` includes the Maldives Ocean Use Survey. `scripts/seed-maldives-survey.js` builds that form from `snapshots/maldives-ocean-use` while `snapshot:create` runs. `demo-palawan` includes the Coral Restoration Survey, a single-sector spatial question. `scripts/seed-palawan-survey.js` builds it from `snapshots/palawan-coral-survey`. Both spatial questions use the project's Light and Satellite basemaps.
- Use the app's SQL functions (`create_project`, `copy_data_library_template_item`, …). Direct inserts only where no function exists, with a check in `scripts/snapshot-create.sh`.
- Data-library templates (`src/DataLibrary/snapshotTemplateIds.js`) and their `data_upload_outputs`: copied from production onto `superuser` only. The remotes are production object keys; `cleanupDeletedOverlayRecords` protects `superuser` outputs outside production and nothing else. Geostats for those templates are `snapshots/geostats/<TEMPLATE_ID>.json`, loaded onto the template data source during `snapshot:create`.
- Survey Basic Template appearance. The template row is created by a migration with an empty welcome page. Production sets the background in the superuser survey editor, and `fixtures.sql` copies those columns into the snapshot. A migration must not write them.

## Neither

Signing keys, Google Maps tile sessions, graphile-worker jobs. Anything that is machine-specific or expires. `scripts/setup.sh` creates them after restore.
