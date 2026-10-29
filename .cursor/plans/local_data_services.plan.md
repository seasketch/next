---
name: Local data services
overview: "Implementation sketch. Source of truth is design-docs/dev-environment/local-data-services.md; that file wins if they disagree. Refresh this sketch as steps land."
todos:
  - id: phase-0a-uploads-r2
    content: "Phase 0a: raw uploads S3 -> R2 (ssn-spatial-uploads-tmp, 24h expiry). Merged and deployed."
    status: completed
  - id: phase-0b-storage-model
    content: "Phase 0b: one S3 client factory per runtime, parquet_url, URLs not keys to workers, owned-bucket rule, hostnames out of data-path code. Merged and deployed."
    status: completed
  - id: phase-1
    content: "Phase 1: local-r2 launcher, pmtiles-server sessions, spatial-uploads and subdivision containers, ElasticMQ, data profile default, upload journeys in CI. One pull request, in review."
    status: in_progress
  - id: phase-2-processors
    content: "Phase 2: overlay worker 3007, data tables on local storage, fragment server.ts, sketch-preprocessing under wrangler dev, journeys"
    status: pending
isProject: false
---

# Local data services: implementation sketch

Working notes for implementing [local data services](../../design-docs/dev-environment/local-data-services.md). The record describes *what* and *why*; this file is the ordered *how*, with file pointers gathered in October 2026. Pointers go stale; the record does not. When a step changes the design, correct the record in place and then this file.

## Order and pull-request boundaries

Each numbered item below is one pull request. Phase 0 is implemented and tested from a laptop against the real `ssn-spatial-uploads-tmp` bucket before production is switched. Deploy is manual, so merging does not cut over. The production switch is one hard cut of bucket name and client after both phase 0 pull requests are ready, then the verification checklist. Phase 1 and 2 items change no production behavior except where noted.

1. Phase 0a: raw uploads to R2. Merged and deployed, October 2026.
2. Phase 0b: the storage model. Merged and deployed, October 2026.
3. Phase 1: everything needed to check out the branch, run `npm run dev`, upload a layer, and see it on the map from local storage. One pull request, in review.
4. Phase 2: overlay worker, data tables, fragment worker, sketch preprocessing, journeys.

Phase 1 was first sketched as five pull requests (storage, `pmtiles-server`, the uploads container, ElasticMQ and subdivision, startup wiring). That split was dropped: none of the slices does anything reviewable alone, and the thing to review is a stack that boots and processes an upload. The record's *Phase 1 as built* section holds what implementation changed.

## The laptop portion of the spike

The Miniflare S3 API was verified on a shared VM on 2026-10-27, and `npm test --workspace local-r2` now repeats those calls against a session it starts itself. What remains is laptop-specific and worth doing once before the phase 1 exit criterion is marked: a 3 GB presigned PUT, concurrent writes and reads across sessions, and throughput on a local SSD. Start `npm run dev --workspace local-r2` and drive the SDK at `http://localhost:8333/cdn-cgi/local/r2/s3` with the launcher's printed credentials; the original spike configuration is kept below for reference.

```jsonc
// /tmp/s3test/wrangler.jsonc
{
  "name": "s3test",
  "main": "src/index.js",
  "compatibility_date": "2026-06-01",
  "r2_buckets": [
    {
      "binding": "BUCKET",
      "bucket_name": "ssn-tiles-local",
      "local_dev": {
        "experimental_s3_credentials": {
          "accessKeyId": "local",
          "secretAccessKey": "localsecret"
        }
      }
    }
  ]
}
```

Run `npx wrangler dev --port 8333 --persist-to /tmp/s3test/.data` and point an S3 client at `http://127.0.0.1:8333/cdn-cgi/local/r2/s3` with `forcePathStyle: true`, `region: "auto"`, those credentials, and `requestChecksumCalculation: "WHEN_REQUIRED"`. Exercise `PutObject` with a file stream, `lib-storage` `Upload` with 50 MB parts, `HeadObject`, ranged `GetObject`, `DeleteObject`, a presigned `PutObject` driven by `fetch`, and a second `wrangler dev` session with a plain binding on the same `--persist-to` reading the result. Watch `workerd` resident memory with `ps`. Without `WHEN_REQUIRED`, the streamed `PutObject` fails with "Provided readable stream must have a known length"; that failure is expected and is why the setting is in the client factory.

## Phase 0a: raw uploads move from S3 to R2

**Cloudflare.** Create the `ssn-spatial-uploads-tmp` bucket in Western North America, next to the `us-west-2` Lambdas. Add a lifecycle rule that deletes objects after 24 hours and aborts incomplete multipart uploads after 24 hours (`wrangler r2 bucket lifecycle add`). Copy the S3 CORS rule from `packages/infra/lib/DataUploadsStack.ts`: origins `*`, methods `HEAD`, `GET`, and `PUT`, all headers. `localhost:3000` still uploads to this bucket until phase 1. The existing account-wide R2 token already covers the new bucket.

**API.** The presign sites that target the staging bucket today:

- `packages/api/src/plugins/dataUploadTaskPlugin.ts` (`getSignedUrlPromise("putObject")` with `S3_REGION` and `SPATIAL_UPLOADS_BUCKET`)
- `packages/api/src/plugins/replacePMTilesPlugin.ts` (its staging presign only; its R2 client for `ssn-tiles` stays)
- `packages/api/src/plugins/overlayDataTablePlugin.ts`

`dataSourcePlugin.ts` presigns against `data_sources_buckets` and stays on S3. Each staging presign switches to an R2 client (`endpoint: R2_ENDPOINT`, `signatureVersion: "v4"`, `s3ForcePathStyle: true` for aws-sdk v2), constructed the way `writeProjectAclDoc.ts` does. The shared client factory waits for phase 0b. `SPATIAL_UPLOADS_BUCKET` stays the bucket-name variable, now set to `ssn-spatial-uploads-tmp`. `reprocessLegacyDataSource.ts` writes the staged object and follows. `processDataUpload.ts` and `updateCRWTemplate.ts` construct an S3 client they never call; drop those. The handler reads `s3://$BUCKET/$objectKey` from its environment, so the cutover is that environment change and nothing stored on the row.

**Handlers.** `packages/spatial-uploads-handler/src/handleUpload.ts` (around lines 303 and 340) builds an S3 client to read the staged upload; it uses the R2 client from `remotes.ts` instead. `packages/data-tables-handler/src/remotes.ts` and `handleDataTableUpload.ts` read `BUCKET` from S3; same change. Both Lambdas need `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and the new bucket name in their environment.

**CDK.** `GraphQLStack.ts` sets `SPATIAL_UPLOADS_BUCKET` from `props.spatialUploadsBucket.bucketName`; it becomes a value from the environment. `UploadHandlerLambdaStack.ts` and `DataTablesHandlerLambdaStack.ts` drop the S3 bucket grants and pass the R2 variables. `DataUploadsStack.ts` stays until the S3 bucket has drained; remove `DataUploadsNormalized` now after confirming nothing reads it (nothing in handler code does).

**Client.** No change. `packages/client/src/admin/uploads/ProjectBackgroundJobManager.ts` PUTs to whatever URL it is given and reports `onUploadProgress`.

**Verify on production.** The checklist is in the record under *Phase 0 verification*: shapefile, GeoJSON, GeoTIFF, FlatGeobuf, data table; a file over 1 GB with the progress bar; a cancelled upload; a PMTiles replacement; handler logs showing the staged read from R2; the lifecycle rule present; the probe's new `presignedUploadUrl` check. Rollback is the previous bucket name and client.

**Landed locally, 2026-10-27.** The bucket exists in WNAM. Lifecycle expires objects and aborts incomplete multipart uploads after 1 day (the API's unit for 24 hours). CORS matches the S3 rule. Laptop `.env` files point at the bucket. A presigned PUT, a `localhost:3000` CORS preflight, and the upload handler's `getObject` round-tripped. Production stays on S3 until the deploy workflow runs. The anonymous production probe still has no admin session, so its `presignedUploadUrl` check is not added yet.

## Phase 0b: the storage model

**Migration** (`packages/api/migrations/current.sql`): add `overlay_data_tables.parquet_url text`, backfill as `'https://uploads.seasketch.org/' || key-part-of(parquet_remote)` after asserting every `parquet_remote` names `ssn-tiles`, then `NOT NULL`. The column comment starts with `@omit` on its own line — PostGraphile stops reading smart tags once the description starts — so the GraphQL schema stays the same. Redefine `clipping_layers_for_geography`, `clipping_layers_for_sketch_class`, and `clipping_layer_source` to return the FlatGeobuf output's `url` as `fgb_url` instead of `data_layers_vector_object_key(...)`. The output column is renamed, so those functions are dropped and recreated. `geography_clipping_layers_object_key` stays and is marked `@deprecated`: it still returns `data_upload_outputs.remote`, which is what the previous client selects as `GeographyClippingLayer.objectKey`. `publish_table_of_contents` and `copy_table_of_contents_item_recursive` insert `overlay_data_tables` with explicit column lists, so those lists copy `parquet_url` too. `complete_overlay_data_table_upload` and the organism reprocess write it from `overlay_data_table_parquet_public_url`, which honors `seasketch.uploads_base_url` set from `UPLOADS_BASE_URL`.

**One client factory per runtime.** New `packages/api/src/storage/` (or similar) exporting a v2 `S3` and a v3 `S3Client` built from `R2_ENDPOINT`, path style, env credentials, and `requestChecksumCalculation: "WHEN_REQUIRED"`. Replace the construction sites:

- API: `tasks/cleanupDeletedOverlayRecords.ts`, `tasks/updateCRWTemplate.ts`, `tasks/processDataUpload.ts`, `tasks/reprocessLegacyDataSource.ts`, `src/tilesAcl/writeProjectAclDoc.ts`, `src/plugins/overlayDataTablePlugin.ts`, `src/plugins/organismPlugin.ts`, `src/DataLibrary/dataLibraryUtils.ts`, `src/plugins/dataSourcePlugin.ts`, `src/plugins/dataUploadTaskPlugin.ts`, `src/plugins/metadataParserPlugin.ts`, `src/plugins/replacePMTilesPlugin.ts`, `src/plugins/fileUploadPlugin.ts`. Leave the public-uploads, sprites, consent, offline-tile-package, and style clients alone; they are out of scope.
- `packages/spatial-uploads-handler/src/remotes.ts` and `handleUpload.ts`; `packages/data-tables-handler/src/remotes.ts`.
- `packages/subdivision-worker/lambda_handler.py` `_create_r2_client`; boto3 1.34 sends no trailers, but set `request_checksum_calculation="when_required"` if boto3 is ever upgraded past 1.36.

**Read URLs, do not rebuild them.** Files that hold `uploads.seasketch.org` or `tiles.seasketch.org` today and are on the data path: `src/overlayEngine/JobStatusUpdater.ts`, `src/plugins/GeographyPlugin.ts` (`getBoundsForClippingLayer` decides by output `type`), `src/plugins/metadataParserPlugin.ts`, `src/plugins/overlayDataTablePlugin.ts` (`remoteToPublicUrl`, `remoteToQueryUrl`, `remoteToOrgQueryUrl`, `remoteToTemporalPreviewUrl`, `remoteToSiblingUrl` derive from `parquet_url`), `src/plugins/replacePMTilesPlugin.ts`, `src/plugins/reportsPlugin.ts`, `src/sketches.ts`, `tasks/calculateSpatialMetricsBatch.ts`; `packages/overlay-worker/src/overlay-worker.ts`; `packages/fragment-worker/src/handler.ts`; `packages/sketch-preprocessing-worker/src/utils/fetch-utils.ts`; `packages/infra/lib/SubdivideWorkerLambdaStack.ts` (`R2_PUBLIC_BASE_URL` becomes `UPLOADS_BASE_URL`). `packages/pmtiles-server/src/index.ts` keeps its hostname comparison until phase 1 adds `UPLOADS_HOST`. Out of scope and left alone: `visitorMetrics.ts`, `userActivityPlugin`, the overlay-engine test fixtures and viewer, the client's homepage and test data.

**URLs to workers.** `GeographySettings.clippingLayers[].source` is a URL from the API. Sketch preprocessing still accepts a bare key on `https://uploads.seasketch.org` for a stale client and for `vectorObjectKey`. Per-origin undici pools in the overlay worker, the fragment worker, and `sketches.ts`.

**Owned-bucket rule.** A helper `ownsRemote(remote)` reads `R2_TILES_BUCKET` and `SPATIAL_UPLOADS_BUCKET`. `cleanupDeletedOverlayRecords.ts` and the layer-deletion cleanup skip and log foreign remotes instead of deleting.

**Deploy order.** Recorded in `design-docs/dev-environment/local-data-services.md` under *Phase 0b deploy order*. Workers and Lambdas first (`SpatialUploadHandler`, `DataTablesHandler`, `SeaSketchOverlayWorker`, `SeaSketchFragmentWorker`, `SeaSketchSubdivisionWorker` with `UPLOADS_BASE_URL`, and the sketch-preprocessing Worker). Then the production workflow, which already runs migrations, the API, and the client in that order. The sketch-preprocessing Worker has to be live before the client, because the client sends `fgbUrl` and the Worker in production treats that string as an object key. `objectKey` stays so a browser that has not reloaded can still query and sketch. In-flight jobs are not given a compatibility window. Then verify: full upload, data-table, geography, sketch, and report flows; a deletion with its cleanup confirmed in R2; a query that every `parquet_url` resolves; the probe green.

**Landed locally, 2026-10-27.** The migration, the shared clients, stored URLs, and the owned-bucket check are in the working tree. `dataSourcePlugin` and the public-upload, sprite, consent, offline-tile-package, and style clients stay as they are. `reportsPlugin` still names `land-big-2.fgb` on the public uploads host, which is reference data. Production is unchanged until this migrates and deploys. The boto3 pin is 1.34, which has no checksum-trailer setting; the subdivision client sets path-style addressing and will take `request_checksum_calculation` when that pin moves past 1.36.

## Phase 1

Pointers below were re-checked against `master` after phase 0 landed (commits `567bab90`, `29ad7ee1`, `aeb7accb`, `aaec89e5`). What that changed for the plan:

- `scripts/dev.config.mjs` already carries `data-tables` (3006), `spatial-uploads` (host mode, 3005), `subdivision` (Compose `--profile workers`, 9000), and `screenshotter` (8791) in the `core` profile, and `servicesInProfile("data")` returns core plus `data`. Phase 1 moved the data-path entries out of `core` and made `data` the default.
- The API's dev-handler path (`tasks/processDataUpload.ts` `runLambda`) POSTs the event JSON to `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER` as-is and parses the JSON reply. The Lambda emulator's invoke URL takes exactly that, so pointing the variable at `http://localhost:9001/2015-03-31/functions/function/invocations` needs no API change. `beginFeatureLayerConversion.ts` uses the same variable.
- `pmtiles-server` runs two Workers from two config files in one session (`wrangler dev -c wrangler.toml -c wrangler.data-tables.toml`), both binding `TILES_BUCKET` with `bucket_name = 'ssn-tiles'` and `preview_bucket_name = 'ssn-tiles'`. `PUBLIC_HOSTNAME` is a required secret used by `tilesBackend.ts` for TileJSON URLs; `.dev.vars.example` sets it to `localhost:8787`.
- `packages/api/.env.template` has `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_FILE_UPLOADS_BUCKET`, but not `R2_TILES_BUCKET`, `SPATIAL_UPLOADS_BUCKET`, `UPLOADS_BASE_URL`, or `TILES_BASE_URL`. `env-manifest.json` has only `DATA_TABLES_LAMBDA_DEV_HANDLER` and `TILES_ACL_NAMESPACE` from the data path.
- `scripts/build-images.mjs` prebuilds the images CDK deploys and asserts its list matches the `DockerImageAsset` count in `packages/infra/lib`. The Dockerfile split keeps that inventory check passing; the application image is still the one CDK builds.
- The spike's two `wrangler dev` sessions are gone; the contract test replaces them.

### As landed (one pull request, October 2026)

File pointers for the branch. Each bullet is one piece of the stack; together they are what `npm run dev` starts.

- **Storage.** `packages/local-r2`: `wrangler.jsonc` names `ssn-tiles-local` (`TILES_BUCKET`) and `ssn-spatial-uploads-tmp-local` (`SPATIAL_UPLOADS_BUCKET`) with the fixed `local` / `local-r2-secret` credentials. `config.mjs` parses it and exports the port, credentials, bucket names, `compatibilityDate`, `wranglerBin`, and the Miniflare module nested under `wrangler`. `bin/dev.mjs` starts Miniflare directly with `host.docker.internal/*` as a route (see the record for why `wrangler dev` could not be used) on `LOCAL_R2_PORT` with `<LOCAL_R2_PERSIST_TO>/v3` as the persistence path; `LOCAL_R2_ALLOWED_HOSTS` adds names. `test/s3-api.test.mjs` starts that launcher. `.data/` is gitignored and `setup.sh --reset` clears `.data/wrangler` or `.data/wrangler-<suffix>`.
- **Serving.** `packages/pmtiles-server/bin/dev.mjs tiles|uploads` runs `wrangler dev` on 8787 or 8788 against the same persistence directory with `--inspector-port 0`; the tiles session also loads `wrangler.data-tables.toml` for the `DATA_TABLES` binding. `preview_bucket_name = 'ssn-tiles-local'` in both configs. `src/resource.ts` `isUploadsHost` reads `UPLOADS_HOST` (comma-separated); `src/tilesBackend.ts` `publicBaseUrl` accepts a full origin in `PUBLIC_HOSTNAME`.
- **Upload handler.** `packages/spatial-uploads-handler/Dockerfile.runtime` is the slow stage (GDAL, tippecanoe, go-pmtiles, rclone, the Python raster libraries). `scripts/runtime-image.mjs` derives its tag from the file's content hash and pins it in `Dockerfile`; `.github/workflows/spatial-uploads-runtime.yml` publishes `ghcr.io/seasketch/spatial-uploads-runtime:<tag>` when the file changes or by hand. `Dockerfile` builds the workspace on the Lambda Node base and copies it onto the runtime image. `compose.yaml` `spatial-uploads` runs it under the emulator on 9001 with `host.docker.internal` values for storage and Postgres and a `develop.watch` on `dist/`; the root `.dockerignore` exempts that `dist/`. `src/processVectorUpload.ts` skips PII classification when `GEOSTATS_PII_CLASSIFIER_ARN` is unset.
- **Subdivision and the queue.** `compose.yaml` `subdivision` moves to the `data` profile with `SQS_ENDPOINT`, local storage values, and `STORAGE_ORIGIN_MAP` for the input URL. `elasticmq` on 9324 with `elasticmq.conf` (queues `overlay-engine-results` and `overlay-engine-results-e2e`, request timeout above the API's 20 s long poll). `packages/api/src/overlayEngine/sqsClient.ts` is the one SQS client factory, honouring `SQS_ENDPOINT`. `tasks/preprocessSource.ts` posts to `SUBDIVISION_WORKER_DEV_HANDLER` when set, which takes precedence over the ARN. `lambda_handler.py` reads `SQS_ENDPOINT`, falls back to `AWS_REGION`, and applies the origin map.
- **Startup.** `scripts/dev.config.mjs` and `scripts/dev.data.mjs`: profiles `data` (default), `core`, `e2e`; entries `local-r2`, `pmtiles-tiles`, `pmtiles-uploads`, `elasticmq`, `spatial-uploads`, `spatial-uploads-tsc`, `subdivision`, `data-tables`, `compose-watch` (one session over the watched containers; its command is a function of the started set), and the opt-in `spatial-uploads-host`. `dev.data.mjs` holds the per-profile ports, compose project, database, persistence directory, and the two-control rule that decides between injecting a local value and honouring a production one. `compose.yaml` names the default network `seasketch` so the e2e project shares the developer's bridge. `scripts/status.mjs` lists the default profile. `.vscode/tasks.json` gains `Dev: core only`.
- **Templates and manifest.** `packages/api/.env.template` carries the local storage block and the base URLs with the production overrides commented. `env-manifest.json` classes the new variables and forbids the production endpoint, ARNs, and an `amazonaws.com` queue URL in CI; `tests/envProfile.test.ts` covers the rules.
- **CI and journeys.** `packages/e2e/tests/uploads.spec.ts`: a small GeoJSON (uploads host) and a generated one above the tiling threshold (tiles host). `.github/workflows/unit-tests.yml` smoke job checks the runtime image pin, logs in to GHCR, pulls the image before Playwright starts, and has `packages: read`. The first run on a branch that changes `Dockerfile.runtime` needs the publish workflow to finish first; the pull step says so when the tag is missing.

### Verification done on the branch

- `npm test --workspace local-r2`: eleven contract tests, including the `Host` rule, in about one second.
- Both upload journeys green against the e2e profile; rows carry `localhost:18787` / `18788` URLs and `r2://ssn-tiles-local/` remotes; the tiles host served TileJSON and a `.mvt`.
- `npm run dev` (data profile) brought up every service and `npm run status` listed them.

Still to do on a laptop: the 3 GB presigned PUT, ten consecutive uploads with concurrent reads, and the throughput number from the record's open questions.

## Phase 2

- Overlay worker: `server.ts` port 3006 → 3007; `SQS_ENDPOINT`; per-origin pools; token rule (no `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` outside production means no header, one log line); clipping sources as URLs. `OVERLAY_WORKER_DEV_HANDLER` injected by `npm run dev`.
- Data tables handler: its `.env` points at the local S3 API and `ssn-tiles-local`; confirm the tiles-host `pmtiles-server` serves the parquet through the `overlay-data-tables` service binding under `wrangler dev` (service bindings between two local sessions need `--persist-to` shared and the binding named in both configs; if that is awkward, run `overlay-data-tables` as a third session).
- Fragment worker: `packages/fragment-worker/src/server.ts` on 3008 reading a JSON Lambda event; `FRAGMENT_WORKER_DEV_HANDLER` in the four `sketches.ts` invocations; URLs, pools, token rule.
- Sketch preprocessing: `wrangler dev` on 8789 with `--persist-to .data/wrangler`; the client's two hardcoded URLs in `SketchEditorModal.tsx` and `GeographyAdmin.tsx` move to `REACT_APP_SKETCH_PREPROCESSING_URL` with the deployed URL as default; the Worker reads its own origin through the binding and others over HTTP; drop the `DEV` branch.
- Journeys: data-table import, a report card with overlay metrics, and sketch clipping against a geography that mixes a production EEZ with a local layer.
- Mark the phase 2 exit criterion, and the data-profile exit criterion in `local-services.md`.

## Open items carried from the record

- 0b: decided. Deploy order is in the record under *Phase 0b deploy order*. Workers and Lambdas first, then migrations, API, and client.
- 1: `preview_bucket_name` decided; runtime image pinned by content-hash tag, decided. Still open: the laptop portion of the spike (3 GB presigned PUT, ten consecutive uploads with concurrent reads, throughput); whether to file the `aws-chunked` issue against Miniflare.
- 2: a local mode with tile access control on; containerizing the Node processors.
