---
name: S-57 nautical chart basemaps
overview: "Implementation sketch. Source of truth is design-docs/enc-basemaps/enc-basemaps.md; that file wins if they disagree. Phase 1 takes an uploaded S-57 zip to a styled, access-controlled ENC basemap. Phase 2 adds NOAA ENC as a shared basemap through the data library. Refresh this sketch as steps land."
todos:
  - id: p0-gates
    content: "Phase 0: confirm the GDAL S57 driver and its CSV tables exist in the spatial-uploads container; pick and commit 3 to 4 small NOAA cells plus one update file; get a legal read on S-52 and S-101 artefacts before any are copied into the repo"
    status: pending
  - id: p1-harness
    content: "Phase 1 step 1: ground-truth harness. Headless render of fixed z/x/y views, reference captures from the NOAA ECDIS service, enc-tiles, and tile57 (mvt), pixel diff report"
    status: pending
  - id: p1-normalize
    content: "Phase 1 step 2: normalize stage and tile schema contract (layer taxonomy, derived properties, code-list encoding), unit tested on the fixture cells"
    status: pending
  - id: p1-processor
    content: "Phase 1 step 3: S-57 processor in spatial-uploads-handler (detect, reject S-63 and S-101, read with updates, normalize, tippecanoe, pmtiles, catalog.json), run in the container"
    status: pending
  - id: p1-quilting
    content: "Phase 1 step 4: usage-band quilting, first as band-to-zoom ranges, then clipping by higher-band coverage; measure regional-bundle limits against the Lambda"
    status: pending
  - id: p1-style-builder
    content: "Phase 1 step 5: enc-style-builder package, rule table, palettes, settings to style, sprite and glyph build, visual diff against the harness"
    status: pending
  - id: p1-schema-api
    content: "Phase 1 step 6: current.sql for ENC basemap type and enc_basemaps, upload mutation, processing_options.kind s57, processDataUploadOutputs branch, attestation"
    status: pending
  - id: p1-acl
    content: "Phase 1 step 7: ENC basemaps are public. List ENC tile UUIDs under public in the project ACL document and rewrite it on create; block non-public ACLs for ENC basemaps in API and UI; tests. Restricted ENC basemaps are a later phase"
    status: pending
  - id: p1-client
    content: "Phase 1 step 8: MapContextManager ENC branch, basemap picker, admin ENC editor with catalogue and settings and live preview"
    status: pending
  - id: p1-touchpoints
    content: "Phase 1 step 9: audit and fix every consumer of basemaps.url (surveys, bookmarks and screenshotter, offline, optional layers, cartography comparison)"
    status: pending
  - id: p1-e2e
    content: "Phase 1 step 10: Playwright journey and API integration tests; fixture ENC basemap for local dev"
    status: pending
  - id: p2-shared-basemap
    content: "Phase 2: NOAA ENC shared basemap on the superuser project, weekly job, fan-out per cell, data library entry, golden snapshot fixture"
    status: pending
isProject: false
---

# S-57 nautical chart basemaps: implementation sketch

Working notes for [S-57 nautical chart basemaps](../../design-docs/enc-basemaps/enc-basemaps.md). The record describes *what* and *why*; this file is the ordered *how*, with file pointers gathered in November 2026. Pointers go stale; the record does not. When a step changes the design, correct the record in place and then this file.

This branch is a spike. Expect the first steps to change the tile schema and the settings object. Keep the schema and settings versioned from the first commit so those changes are cheap.

## Order and pull-request boundaries

Each numbered item is one pull request unless noted. Steps 1 to 5 change nothing a user can see and can merge as they finish. Step 6 onward changes the database and API and should merge in order. The feature stays hidden behind the `ENC` basemap type, so no flag is needed. The create flow is only reachable from the new admin page, which step 8 adds last.

## Phase 0: gates

- **GDAL S57 driver.** `packages/spatial-uploads-handler/Dockerfile` builds GDAL 3.9.2 from source with a fixed option list. The S57 driver is built in by default, but it needs `s57objectclasses.csv` and `s57attributes.csv` at runtime (`S57_CSV` or `GDAL_DATA`). The final image sets `GDAL_DATA=/usr/share/gdal` and copies `/usr/share` from the build stage, so confirm the CSVs are in that directory. Run `ogrinfo --formats | grep S57` and `ogrinfo -ro CELL.000` inside the container image before anything else. Run the same check against `gdal-async` 3.11.3, which the handler imports in Node.
- **Fixtures.** NOAA ENCs are public domain. Choose cells that cover one harbour at bands 3 to 5, one coastal and one approach cell with overlap, one cell with an update file, and one with many soundings and a light with sectors. Keep each under a few hundred kilobytes where possible. Record the NOAA citation in a `README` beside them. Location: `packages/spatial-uploads-handler/test/fixtures/enc/`.
- **Legal.** Do not check in S-52 Presentation Library tables, the S-101 catalogue, or tile57 and enc-tiles symbols until the licence read is done. The first generator uses our own SVG symbols and colour tokens. The reference tools are run, not copied.
- **Tool installs for the harness.** tile57 is a Zig binary with releases for Linux; enc-tiles is a Node project. Install both outside the repo.

## Phase 1

### 1. Ground-truth harness

Build the checking loop before the thing being checked, so every later step can use it.

- A script (location: `packages/enc-style-builder/harness/`) takes a list of `{ cell, z, x, y }` views and renders each with our basemap in headless Chromium. Playwright is already a dependency in `packages/e2e`; Chromium is a separate download (`npm exec --workspace @seasketch/e2e -- playwright install chromium`).
- Reference captures: NOAA ECDIS WMS (S-52 symbology) via a plain GetMap on the same bounding box; enc-tiles output; tile57 baked with `--format mvt` and drawn with `mapbox-gl`. Cache the captures outside git and record the commands and versions in the harness `README`.
- A report page lists each view side by side with a pixel-difference score and writes a summary JSON. The score is a tracking number, not a pass/fail, until a baseline exists.
- Everything runs locally from a bare checkout, with the fixture cells, without network access except for fetching the NOAA references.

### 2. Normalize stage and tile schema

- New module in `spatial-uploads-handler/src/formats/` (next to `delimited.ts` and `netcdf.ts`): `s57/`, with `classify.ts` (class to layer), `attributes.ts` (code lists, derived properties), `soundings.ts`, `lights.ts` (description string and sector geometry), `normalize.ts`.
- Use the S-57 object and attribute catalogue CSVs to decode, and keep our own mapping table for layers and derived properties. Do not hard-code the catalogue contents.
- Output is newline-delimited GeoJSON with a `tippecanoe` object per feature (layer, minzoom, maxzoom) that tippecanoe reads directly.
- Guard JSON and attribute values defensively; GDAL returns strings, numbers, and null for the same attribute depending on the cell. Add unit tests for the guard functions that follow `AGENTS.md` (null, undefined, non-objects, a valid example).
- Update the schema table in the record as the spike changes it, and bump `ENC_SCHEMA_VERSION`.

### 3. Processor

- `processS57Upload.ts` beside `processVectorUpload.ts` and `processRasterUpload.ts`. `handleUpload.ts` currently decides by extension (`.tif`, `.nc`, else vector) and refuses outputs with more than one vector layer. Add an explicit branch on `processingOptions.kind === "s57"` before the extension test, and give the processor its own response type, not `ProcessedUploadLayer`.
- Inputs: a zip. Extract with the same `unzip` the container ships, find base cells by extension, sort update files by update number, and read the catalogue if present.
- Detection and rejection: read the ISO 8211 leader of each `.000` to tell S-57 from S-101, and reject encrypted cells with a message that says what to upload instead.
- Outputs, using the existing `output` shape and remotes:
  - `PMTiles` to `TILES_REMOTE/${baseKey}/${jobId}.pmtiles`, with `baseKey` unchanged (`projects/${slug}/public`).
  - The original zip to the private resources remote.
  - `catalog.json` beside the tiles.
- Progress reporting through `updateProgress`, with a step per cell so a long upload shows movement.
- Choose tippecanoe settings deliberately. `processVectorUpload.ts` runs it with `-zg`, `--generate-ids`, `--drop-densest-as-needed`, `-r 1` for points, and a single `-l` layer, then `pmtiles convert` from mbtiles. ENC needs several layers (per-feature `tippecanoe.layer`, or one `-L` per layer file), explicit min and max zoom per feature, no dropping of soundings or aids to navigation, and every kept attribute. Document each flag and why.

### 4. Quilting and limits

- First pass: band to zoom range. The scale bands of an ENC cell map to ranges of web zoom; features carry `band`. Check the result visually with the harness on the overlap fixtures.
- Second pass: clip lower-band area and line features by the union of higher-band `M_COVR` polygons within the overlap zoom range. Use GEOS through GDAL or a TypeScript geometry library already in the repo (`packages/overlay-engine` has polygon tools; check before adding a dependency).
- Measure: wall time, memory, and scratch disk for a 20-cell and a 100-cell bundle in the Lambda container locally and in the real Lambda. `UploadHandlerLambdaStack` sets a 15 minute timeout, 10240 MB memory, and 5 GiB ephemeral storage. If the 100-cell bundle fails, record the failure and design fan-out per cell (Phase 2 requires it anyway); do not raise the limits as a first reaction.

### 5. `enc-style-builder`

- New workspace package modelled on `packages/gl-style-builder`: composite TypeScript project, vitest, `main`/`types` into `dist/lib`, project references only to packages it uses. No `import type` anywhere, since the client imports it.
- `lib/rules/` holds the declarative rule table, one file per tile layer. `lib/palettes.ts` holds colour tokens for three palettes. `lib/settings.ts` holds defaults, validation, and `ENC_SETTINGS_VERSION`. `lib/build.ts` assembles the style.
- `assets/symbols/*.svg` and a `scripts/build-sprite.ts` that emits the sprite sheet at 1x and 2x with a manifest; `scripts/build-glyphs.ts` that emits glyph PBFs from one open-licensed font. Output is written outside `src` and uploaded in a deploy step; record the path decision in the record.
- Unit tests assert structure (layer order, filters reference only schema properties, every sprite key exists) and a snapshot per palette for a small catalogue. Run the harness for visual checks.
- Start with the layers that carry the chart: `depth_area`, `land`, `coast`, `depth_contour`, `sounding`, `aid`, `hazard`. Add the rest by band of difficulty. Record each approximation in `docs/approximations.md` beside the package.

### 6. Database and API

Follow `AGENTS.md`: all schema work in `packages/api/migrations/current.sql`, never in `committed/` or `schema.sql`.

- `alter type basemap_type add value 'ENC'`, committed on its own if the migration runner requires it. `create table enc_basemaps` as described in the record, with policies matching `basemaps`. Superuser and project-admin access only for writes.
- Upload entry point: a mutation that returns a presigned upload URL and creates the `project_background_jobs` and `data_upload_tasks` rows the way the existing upload mutation does (`packages/api/src/spatialUploads/index.ts` and the upload plugin), with `processing_options.kind = 's57'`, the basemap name, and the attestation. Add `ProcessedEncBasemap` to `spatial-uploads-handler/src/spatialUploadsHandlerTypes.ts`.
- `processDataUploadOutputs.ts` branches on the response kind and calls a new `createEncBasemapRecords` in `packages/api/src/spatialUploads/`. It creates the `basemaps` row (type `ENC`, `url` is the hosted tile base), the `enc_basemaps` row, the default public ACL via the existing trigger, and then rewrites the project ACL document (step 7).
- The ACL update path for basemaps must refuse any non-public type for an ENC basemap. Find where basemap ACL type is set (`access_control_lists` rows with `basemap_id`) and add the check there, in API code rather than a trigger.
- Settings update mutation validates the settings object server-side with the same `validateEncSettings`.
- Client operations go in `.graphql` files under `packages/client/src/queries/`. Run `npm run graphql:codegen` for generated types. Do not edit `src/generated/`.
- If the schema drifts, use `.agents/skills/db-drift/SKILL.md`.

### 7. Access control (public only)

ENC basemaps are public in phase 1; restriction is a later phase described in the record. The one required change exists because pmtiles-server treats `projects/{slug}/public/{uuid}` as a published layer: with `AUTH_ACL_ENABLED` on and a project ACL document present, a UUID missing from the document's `public` array is admins-only (`classifyUuid` in `packages/pmtiles-server/src/auth/acl.ts`; `authorizeResource` in `resourceAuth.ts`).

- `buildProjectAclDoc` in `packages/api/src/tilesAcl/writeProjectAclDoc.ts` selects only published table of contents items. Add a second query for the project's `ENC` basemaps and append their tile UUIDs (extracted with `extractHostedTilesUuid`) to `public`. No per-basemap ACL logic and no change to the placement merge rules.
- Rewrite the document when an ENC basemap is created, using `writeProjectAclDocToR2` from `createEncBasemapRecords`. It is also rebuilt on every publish, so a deleted basemap's entry disappears then; a stale public entry is harmless. A re-bake that changes the tile UUID must rewrite the document too.
- No change to `hostedTileUuidsRequiringAuth` (ENC UUIDs are public, so the client sends no token), and none expected in `packages/pmtiles-server`.
- Hide the basemap access control UI for ENC basemaps (step 8) and refuse non-public ACLs in the API (step 6).
- Test in `packages/api/tests/tilesAcl.test.ts`: an ENC basemap UUID appears in `public`, a project with no ENC basemaps is unchanged, and a UUID shared with a protected layer still follows the existing merge rule.
- Zero-code alternative if this is unwanted: host ENC tiles under a key that classifies as `public` in `classifyResource` (no `projects/` prefix). It avoids the ACL document entirely but means re-keying when restriction arrives.
- Later phase (not in this spike): read each ENC basemap's own ACL into `buildProjectAclDocFromRows`, write the document on ACL change (currently written by `publishTilesAclPlugin.ts` on publish and `GeographyPlugin.ts`), add protected UUIDs to `getHostedTileUuidsRequiringAuth` so `MapContextManager.hostedUuidNeedsMapAccessToken` sends the token, and lift the UI and API restrictions.

### 8. Client

- `packages/client/src/dataLayers/MapContextManager.ts` builds the base style around line 2420: `RasterUrlTemplate` builds an inline raster style, everything else calls `fetchGlStyle(url)`. Add an `ENC` branch that calls `buildEncStyle`, sets `sprite` and `glyphs` to the hosted asset URLs, and points the vector source `tiles` at the basemap's hosted URL. Requests flow through `requestTransformer` and `authorizeHostedUrl`, which already attach the access token to hosted tile URLs.
- Set `labelsLayerId` from the generator's marker layer id so overlay layers insert under chart labels and symbols.
- Tell the admin in the upload flow that the chart will be publicly readable, and hide the basemap access control for ENC basemaps.
- Basemap admin: `packages/client/src/admin/data/CreateBasemapModal.tsx` has URL, upload, and Mapbox account tabs. Add an ENC tab, or a separate "Nautical chart" entry from the basemap list; the second is likely cleaner since the flow differs (upload, wait for processing, then configure). `BasemapEditor.tsx`, `BasemapEditorPanel.tsx`, and `EditBasemapPage.tsx` get an ENC variant with the catalogue panel and settings panel. Live preview reuses the editor map.
- All visible strings go through `Trans` or `t()`. Do not edit `src/lang/*.json`. Use existing components (Modal, Button, Spinner) and Radix UI.
- Verify with the **Dev: client log** terminal or `npm run logs -- client`, and run `npm run lint` in `packages/client`.

### 9. Touchpoint audit

Every place that reads a basemap's URL or style must handle `ENC`. Known consumers, from a search for `basemapUrl` and `basemap.url`:

- `client/src/offline/BasemapOfflineSettings.tsx`, `AdminOfflineTileSettingsMap.tsx`, and `api/src/plugins/BasemapOfflineDetailsPlugin.ts`: exclude ENC from offline settings with a clear message.
- `client/src/admin/surveys/useMapEssentials.ts`: survey map questions.
- `client/src/admin/data/cartographyComparisonMap.ts`, `OptionalBasemapLayerSetLayersModal.tsx`: optional layer sets assume a style with named layers.
- Map bookmarks (`create_map_bookmark` returns `basemapUrl`) and the `map-screenshotter` worker: confirm screenshots of an ENC basemap work, or fall back with a message.
- `Basemap.isArcgisTiledMapservice` and any other type-based branches: search for `BasemapType.` across the client and API.

### 10. Tests and fixtures

- Handler: unit tests for normalize and detection; an integration test that runs the container locally on the fixture zip and checks the PMTiles layers and properties against the schema contract.
- Style builder: vitest as above.
- API: ACL document tests (step 7), a test that a non-public ACL is refused for an ENC basemap, upload round trip with a stub handler, settings validation.
- E2E: a Playwright journey in `packages/e2e/tests/basemaps.spec.ts` style that selects an ENC basemap in the local project and asserts the installed style has the ENC source and that tile requests succeed with no access token. `packages/e2e/JOURNEYS.md` lists existing journeys.
- Local fixture: a tiny ENC basemap for local development. Because the golden snapshot is rebuilt rarely, add this in Phase 2 with the shared basemap, unless an earlier step needs it. `current.sql` is not part of the snapshot.

## Phase 2: NOAA ENC as a shared basemap

- Shared basemap on the `superuser` project (no `project_id`, attached through `projects_shared_basemaps`). `create_basemap_acl` skips these. Keys under the `superuser` slug classify as `data_library` in pmtiles-server and are always public, so no ACL document entry is needed.
- Scheduled job: model on `packages/api/tasks/updateCRWTemplate.ts`. Download the NOAA all-ENC zip (about 782 MB), process per cell with fan-out, merge, and replace tiles. See `replacePMTilesPlugin.ts` for the replace pattern.
- Fan-out: processing each cell on its own is already how the step 3 code is shaped; add the orchestration (Step Functions or Fargate) in `packages/infra` as a new stack. Decide in the spike which fits the existing CDK app.
- Data library entry: `packages/client/src/admin/data/DataLibraryModal.tsx` is built around table of contents templates. Add a separate "Nautical charts" entry that attaches the shared basemap, or place it in the basemap settings page. Pick the second if the first needs invasive changes.
- Attribution and update date from the NOAA product catalogue.
- Golden snapshot fixture and `snapshotTemplateIds.js` only if the entry stamps a template id. Follow `.agents/skills/data-library/SKILL.md` and `.agents/skills/golden-snapshot/SKILL.md`.

## Decisions to settle early in the spike

- Where static ENC assets live (sprite, glyphs). Candidate: R2 behind the tiles host, versioned by `ENC_SETTINGS_VERSION`.
- Whether the source zip is kept in the private uploads bucket indefinitely, and who can download it.
- Wording of the public-visibility notice and attestation in the upload flow.
- Whether `enc_basemaps.settings` is edited with a live save per control or a single save, given other basemap editors.
- Whether to support more than one ENC basemap per project, and whether two can be combined.

## Verification checklist

Before proposing the first merge:

- The fixture zip uploads through the local stack and produces a basemap that draws on the map.
- With `AUTH_ACL_ENABLED=true` locally and the project ACL document written, an anonymous request for an ENC basemap tile returns 200, and the same request returns 401 or 403 if the UUID is removed from the document's `public` list (proving the step 7 change is what makes it work).
- The harness report shows the NOAA cells at representative zooms next to the NOAA and tile57 references, with the diff scores recorded in the PR.
- `npm run lint` passes in `packages/client`, workspace builds pass with `npm run build`, and `npm run db:drift` is clean.
