---
name: replicate-production-data
description: >
  Copy layers and report cards from a production SeaSketch project into a local
  project for testing. Use when reproducing production report widgets, overlay
  metrics, or data layers locally. Download original source files and submit
  them through the local upload pipeline. Do not insert table-of-contents,
  data-source, or upload-output rows.
---

# Replicating production project data locally

Copy the files, then let the local app process them. A draft report only resolves overlay sources from draft table-of-contents rows (`is_draft = true`). Rows inserted by hand, or published rows that merely point at production tile URLs, are invisible to that report and have no source-processing job. Metrics then fail with `No source processing job id for overlay source`.

The local API, its worker, and `packages/spatial-uploads-handler` (`npm run dev`, `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER`) must already be running. The client dev server must be signed in to the local project.

## Find the files on production

Use the signed-in browser tab on `seasketch.org`. `fetch('https://api.seasket.ch/graphql', { credentials: 'include' })` sends that session. Local GraphQL is a different host and a different auth scheme; do not reuse one for the other.

Report cards are ProseMirror documents on `report { tabs { cards { body componentSettings } } }`. Metric widgets are `blockMetric` nodes. Collect every `stableId` on `attrs.metrics`, and the ids embedded in `componentSettings` (`rowLinkedStableIds`, `customRowLabels`, and similar maps). Keys often look like `<stableId>-*`.

Collect stable ids only from `metrics[].stableId` and from `componentSettings.stableId` (layer toggles store the id there, with an empty `metrics` array). Do not regex the whole document for 9-character tokens. Prose and setting names (`customRowLabels`, `rowsPerPage`) match that pattern and are not layers.

For each id, load the table-of-contents item as an admin (`tableOfContentsItemByStableId`, or page through `draftTableOfContentsItems` / `tableOfContentsItems` when that lookup returns null). Take the `downloadOptions` entry with `isOriginal: true`. Skip PMTiles and `ReportingCOG` / `ReportingFlatgeobufV1`. The upload pipeline rebuilds those.

`isOriginal` is often a GeoTIFF or GeoJSON, and sometimes already a FlatGeobuf (`.fgb`) or NetCDF (`.nc`). Upload a FlatGeobuf original as `.fgb` with `Content-Type: application/octet-stream`. `size` on `downloadOptions` is a string. A file a few dozen bytes off that number can still be a valid FlatGeobuf (`fgb` magic); an HTML body is not.

If the local handler rejects a NetCDF original (`No layers found in NetCDF file`), download the `GEO_TIFF` option instead and confirm the bytes start with `II*` or `MM`. That GeoTIFF is often the same object key with a `.tif` extension. Do not upload PMTiles as a stand-in.

`tableOfContentsItemByStableId` can return null for a draft-only layer, and it can return null because the layer was deleted while the card still names it. Search both TOC lists before treating the id as gone. A missing id is not something to replace with a different local layer unless that layer has `geostats`. `ReportOverlaySource.geostats` is non-null, so one TOC row with null `geostats` makes every widget on the report fail with `Cannot return null for non-nullable field ReportOverlaySource.geostats`. If the production file is gone, leave the id unset or drop that metric so the rest of the card can render.

Download with curl. The URL 403s unless it includes the `download` query string returned by `downloadOptions`. Python `urllib` is also rejected; curl is not.

```bash
curl -fsSL -o "Layer name.tif" "https://uploads.seasketch.org/projects/<slug>/public/<uuid>.tif?download=Layer%20name.tif"
```

Name each file so the production stable id can be recovered after upload, for example `<stableId>__Short_title.tif`. The processor turns the filename into the layer title by replacing only the first `_` with a space. Set the real title afterward.

If `tableOfContentsItemByStableId` returns null, the layer is draft-only or no longer in the list the report was published from. Cached metric values do not include the original file. Keep looking through the admin table of contents before concluding the file is gone.

## Upload through the local API

The data-layer dropzone calls `createDataUpload`, PUTs the bytes to `presignedUploadUrl`, then calls `submitDataUpload`. Do that. Browser file inputs are not a reliable way to hand the files over. The signed-in page cannot read an arbitrary local directory, so serve the downloads from localhost with `Access-Control-Allow-Origin: *` and `fetch` them from the page.

Keep the file server as the foreground process. A server started with `&` in a shell that then exits is killed with the shell.

Local GraphQL is `http://localhost:3857/graphql` (see `packages/client/.env`). Cookies are not enough. Read the Auth0 access token already in the page's `localStorage`. The first `@@auth0spajs@@` key is often the user profile and has no `body.access_token`. Use the entry whose `body.access_token` is set, and send:

- `authorization: Bearer <token>`
- `x-ss-slug: <local project slug>`

Do not print the token or write it to a file.

```graphql
mutation createDataUpload($projectId: Int!, $filename: String!, $contentType: String!) {
  createDataUpload(input: { projectId: $projectId, filename: $filename, contentType: $contentType }) {
    dataUploadTask { id projectBackgroundJobId presignedUploadUrl }
  }
}
```

PUT the file to `presignedUploadUrl` with the same `Content-Type` that was signed (`image/tiff` for `.tif`, `application/geo+json` for `.geojson`). The signature check fails when they differ. Format detection itself uses the filename extension.

Then:

```graphql
mutation submitDataUpload($jobId: UUID!) {
  submitDataUpload(input: { id: $jobId, enableAiDataAnalyst: false }) {
    projectBackgroundJob { id state }
  }
}
```

`enableAiDataAnalyst: false` skips the analyst prompt and starts processing. Wait until each `projectBackgroundJobs` row is `COMPLETE`. Read the new id from `dataUploadTask(id) { tableOfContentsItemStableIds }` on that task. A new upload creates a **draft** item with a **new** 9-character stable id. It does not keep the production id. Name the uploaded file `<productionStableId>__….ext` so a failed job can be matched back to the manifest before that field is filled.

A `.geojson.json` download should be uploaded as `.geojson`. The handler uses the filename extension, and `path.extname` of `name.geojson.json` is `.json`.

`replaceTableOfContentsItemId` is only for replacing a source that is already on the draft item you want to keep. Replacing a published row does not create the draft row a draft report reads.

Set titles with `updateTableOfContentsItem`. Create folders with `createTableOfContentsItem` (`isFolder: true`, a new 9-character stable id from an alphabet that excludes dashes). Move layers with `updateTableOfContentsItemChildren`. New folders default to `is_draft = true`.

## Point the report at the new ids

Draft overlay lookup is `stable_id` plus `is_draft = true`. Pasting a production card body unchanged will not find the new layers.

Rewrite ids in the card JSON before `addReportCard`:

- a string that equals a production stable id
- an object key, or a string, that starts with `<productionStableId>-` (replace that prefix only)

Leave ids you did not upload alone. Pass the rewritten `body` and the original `componentSettings` (`{ type: "textBlock" }` for a prose card that contains metric blocks). `addReportCard` takes `reportTabId` and `cardPosition`.

Uploads store the original plus tiles. They do not store `ReportingCOG` or `ReportingFlatgeobufV1`, which are the only types `is_reporting_type` accepts. The report editor calls `preprocessSource` when someone adds a layer to a card; creating the card through the API skips that call. Call it once per new data source:

```graphql
mutation preprocessSource($slug: String!, $sourceId: Int!) {
  preprocessSource(input: { slug: $slug, sourceId: $sourceId }) {
    tableOfContentsItem { id }
  }
}
```

`sourceId` is `dataLayer.dataSourceId`. The mutation does nothing when a reporting output already exists. Wait until `sourceProcessingJobByDataSourceId` is `COMPLETE` (`state`, `progressPercentage`, `errorMessage` — the type has no `id` field), then reload the report. The client keeps a `No source processing job id for overlay source` error from the request it made before the job existed.

`addReportTab` and `addReportCard` recreate the tab and card structure. `cardPosition` is the index on that tab. `reorderReportTabCards` and `reorderReportTabs` take the full id list in the desired order. The card title is the `reportTitle` inside `body`, not a separate argument. Skip cards that are already on the local report or you will insert duplicates.

`updateReportCard` writes every field you omit. Pass the current `componentSettings` and `alternateLanguageSettings` along with `body`. Omitting `alternateLanguageSettings` sets that not-null column to null and the mutation fails.

The admin preview also needs one of the current user's sketches. A sketch that does not overlap the uploaded features shows zeros in the within-plan column and still shows dataset totals.

## What this writes

`spatial-uploads-handler` and `preprocessSource` use the buckets configured in `packages/spatial-uploads-handler/.env` and `packages/api/.env`. On a machine pointed at production, new objects are created under `projects/<slug>/public/<new-uuid>` and `projects/<slug>/subdivided/…`. Those keys are new. Production table-of-contents rows are not updated, and existing production objects are not replaced.

Do not delete the local layers afterward unless you intend `cleanupDeletedOverlayRecords` to delete those new objects. The originals you downloaded are different keys.
