---
name: Local data services
overview: "Implementation sketch. Source of truth is design-docs/dev-environment/local-data-services.md; that file wins if they disagree. Refresh this sketch as steps land."
todos:
  - id: phase-0a-uploads-r2
    content: "Phase 0a: raw uploads S3 -> R2 (ssn-uploads), presign via R2 client, handlers read from R2, CDK env, deploy, verify checklist"
    status: pending
  - id: phase-0b-storage-model
    content: "Phase 0b: one S3 client factory per runtime, parquet_url, URLs not keys to workers, owned-bucket rule, hostnames out of data-path code, deploy, verify"
    status: pending
  - id: phase-1-local-r2
    content: "Phase 1: packages/local-r2, .data/ persistence and reset, contract test"
    status: pending
  - id: phase-1-pmtiles
    content: "Phase 1: pmtiles-server UPLOADS_HOST and two wrangler dev sessions with local bucket names"
    status: pending
  - id: phase-1-uploads-container
    content: "Phase 1: spatial-uploads Dockerfile split, GHCR runtime image, Compose service on 9001 with watch, STORAGE_ORIGIN_MAP"
    status: pending
  - id: phase-1-subdivision-queue
    content: "Phase 1: ElasticMQ, SUBDIVISION_WORKER_DEV_HANDLER, subdivision on local storage"
    status: pending
  - id: phase-1-startup
    content: "Phase 1: dev.config.mjs entries, env templates, manifest, data profile default, upload journey in CI"
    status: pending
  - id: phase-2-processors
    content: "Phase 2: overlay worker 3007, data tables on local storage, fragment server.ts, sketch-preprocessing under wrangler dev, journeys"
    status: pending
isProject: false
---

# Local data services: implementation sketch

Working notes for implementing [local data services](../../design-docs/dev-environment/local-data-services.md). The record describes *what* and *why*; this file is the ordered *how*, with file pointers gathered in October 2026. Pointers go stale; the record does not. When a step changes the design, correct the record in place and then this file.

## Order and pull-request boundaries

Each numbered item below is one pull request. Phase 0 items each deploy to production and are verified before the next begins. Phase 1 and 2 items change no production behavior except where noted.

1. Phase 0a: raw uploads to R2. Deploy. Verify.
2. Phase 0b: the storage model. Deploy. Verify.
3. Phase 1: `packages/local-r2`, the `.data/` directory, and the contract test.
4. Phase 1: `pmtiles-server` under `wrangler dev` as two sessions.
5. Phase 1: the spatial-uploads container (Dockerfile split, registry image, Compose service).
6. Phase 1: ElasticMQ and subdivision on local storage.
7. Phase 1: startup wiring, templates, manifest, data profile as default, upload journey in CI.
8. Phase 2: overlay worker, data tables, fragment worker, sketch preprocessing, journeys.

Items 3 to 6 can be developed in parallel against a local branch of item 7's `dev.config.mjs` changes, but merge in that order so each is startable on `master` when it lands.

## Before the first commit: repeat the spike on your laptop

The Miniflare S3 API was verified on a shared VM on 2026-10-27 (the output is in the agent's artifacts; the method is below). Repeat it locally once, because the remaining open items are laptop-specific: a 3 GB presigned PUT, concurrent writes and reads across sessions, and throughput on a local SSD.

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

**Cloudflare.** Create the `ssn-uploads` bucket. Add a lifecycle rule that deletes objects after 7 days (`wrangler r2 bucket lifecycle add`). Add a CORS rule allowing `PUT` with the `Content-Type` header and exposing `ETag` from the production client origins; the current S3 rule is in `packages/infra/lib/DataUploadsStack.ts` and is the template. Create or reuse an R2 API token scoped to `ssn-uploads` and `ssn-tiles`.

**API.** The presign sites that target the S3 bucket today:

- `packages/api/src/plugins/dataUploadTaskPlugin.ts` (`getSignedUrlPromise("putObject")` with `S3_REGION` and `SPATIAL_UPLOADS_BUCKET`)
- `packages/api/src/plugins/replacePMTilesPlugin.ts`
- `packages/api/src/plugins/dataSourcePlugin.ts`
- `packages/api/src/plugins/overlayDataTablePlugin.ts`

Each switches to an R2 client (`endpoint: R2_ENDPOINT`, `signatureVersion: "v4"`, `s3ForcePathStyle: true` for aws-sdk v2) and keeps `SPATIAL_UPLOADS_BUCKET` as the bucket name, now set to `ssn-uploads`. Tasks that read or write the staged bucket follow: `packages/api/tasks/processDataUpload.ts`, `tasks/updateCRWTemplate.ts`, `tasks/reprocessLegacyDataSource.ts`. Doing the client factory (phase 0b) first and using it here is reasonable if it keeps this pull request small; otherwise construct the R2 client the way `writeProjectAclDoc.ts` does.

**Handlers.** `packages/spatial-uploads-handler/src/handleUpload.ts` (around lines 303 and 340) builds an S3 client to read the staged upload; it uses the R2 client from `remotes.ts` instead. `packages/data-tables-handler/src/remotes.ts` and `handleDataTableUpload.ts` read `BUCKET` from S3; same change. Both Lambdas need `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and the new bucket name in their environment.

**CDK.** `GraphQLStack.ts` sets `SPATIAL_UPLOADS_BUCKET` from `props.spatialUploadsBucket.bucketName`; it becomes a value from the environment. `UploadHandlerLambdaStack.ts` and `DataTablesHandlerLambdaStack.ts` drop the S3 bucket grants and pass the R2 variables. `DataUploadsStack.ts` stays until the S3 bucket has drained; remove `DataUploadsNormalized` now after confirming nothing reads it (nothing in handler code does).

**Client.** No change. `packages/client/src/admin/uploads/ProjectBackgroundJobManager.ts` PUTs to whatever URL it is given and reports `onUploadProgress`.

**Verify on production.** The checklist is in the record under *Phase 0 verification*: shapefile, GeoJSON, GeoTIFF, FlatGeobuf, data table; a file over 1 GB with the progress bar; a cancelled upload; a PMTiles replacement; handler logs showing the staged read from R2; the lifecycle rule present; the probe's new `presignedUploadUrl` check. Rollback is the previous bucket name and client.

## Phase 0b: the storage model

**Migration** (`packages/api/migrations/current.sql`): add `overlay_data_tables.parquet_url text`, backfill as `'https://uploads.seasketch.org/' || key-part-of(parquet_remote)` after asserting every `parquet_remote` names `ssn-tiles`, then `NOT NULL`. Redefine `clipping_layers_for_geography`, `clipping_layers_for_sketch_class`, and `clipping_layer_source` to return the FlatGeobuf output's `url` instead of `data_layers_vector_object_key(...)`. Follow `AGENTS.md`: if any copied table gains a column, update `publish_table_of_contents` and `copy_table_of_contents_item`; `overlay_data_tables` is not one of them, so this migration should not need that.

**One client factory per runtime.** New `packages/api/src/storage/` (or similar) exporting a v2 `S3` and a v3 `S3Client` built from `R2_ENDPOINT`, path style, env credentials, and `requestChecksumCalculation: "WHEN_REQUIRED"`. Replace the construction sites:

- API: `tasks/cleanupDeletedOverlayRecords.ts`, `tasks/updateCRWTemplate.ts`, `tasks/processDataUpload.ts`, `tasks/reprocessLegacyDataSource.ts`, `src/tilesAcl/writeProjectAclDoc.ts`, `src/plugins/overlayDataTablePlugin.ts`, `src/plugins/organismPlugin.ts`, `src/DataLibrary/dataLibraryUtils.ts`, `src/plugins/dataSourcePlugin.ts`, `src/plugins/dataUploadTaskPlugin.ts`, `src/plugins/metadataParserPlugin.ts`, `src/plugins/replacePMTilesPlugin.ts`, `src/plugins/fileUploadPlugin.ts`. Leave the public-uploads, sprites, consent, offline-tile-package, and style clients alone; they are out of scope.
- `packages/spatial-uploads-handler/src/remotes.ts` and `handleUpload.ts`; `packages/data-tables-handler/src/remotes.ts`.
- `packages/subdivision-worker/lambda_handler.py` `_create_r2_client`; boto3 1.34 sends no trailers, but set `request_checksum_calculation="when_required"` if boto3 is ever upgraded past 1.36.

**Read URLs, do not rebuild them.** Files that hold `uploads.seasketch.org` or `tiles.seasketch.org` today and are on the data path: `src/overlayEngine/JobStatusUpdater.ts`, `src/plugins/GeographyPlugin.ts` (`getBoundsForClippingLayer` decides by output `type`), `src/plugins/metadataParserPlugin.ts`, `src/plugins/overlayDataTablePlugin.ts` (`remoteToPublicUrl`, `remoteToQueryUrl`, `remoteToOrgQueryUrl`, `remoteToTemporalPreviewUrl`, `remoteToSiblingUrl` derive from `parquet_url`), `src/plugins/replacePMTilesPlugin.ts`, `src/plugins/reportsPlugin.ts`, `src/sketches.ts`, `tasks/calculateSpatialMetricsBatch.ts`; `packages/overlay-worker/src/overlay-worker.ts`; `packages/fragment-worker/src/handler.ts`; `packages/sketch-preprocessing-worker/src/utils/fetch-utils.ts`; `packages/infra/lib/SubdivideWorkerLambdaStack.ts` (`R2_PUBLIC_BASE_URL` becomes `UPLOADS_BASE_URL`). `packages/pmtiles-server/src/index.ts` keeps its hostname comparison until phase 1 adds `UPLOADS_HOST`. Out of scope and left alone: `visitorMetrics.ts`, `userActivityPlugin`, the overlay-engine test fixtures and viewer, the client's homepage and test data.

**URLs to workers.** `GeographySettings.clippingLayers[].source` becomes a URL. Workers accept a value with no scheme as a key on `https://uploads.seasketch.org` for one release. Per-origin undici pools in the overlay worker, the fragment worker, and `sketches.ts`.

**Owned-bucket rule.** A helper `ownsRemote(remote)` reads `R2_TILES_BUCKET` and `SPATIAL_UPLOADS_BUCKET`. `cleanupDeletedOverlayRecords.ts` and the layer-deletion cleanup skip and log foreign remotes instead of deleting.

**Deploy order.** Subdivision worker before the API, or let `JobStatusUpdater` accept both message shapes for one release (open question in the record). Then verify: full upload, data-table, geography, sketch, and report flows; a deletion with its cleanup confirmed in R2; a query that every `parquet_url` resolves; the probe green.

## Phase 1

### `packages/local-r2` and `.data/`

- `packages/local-r2/wrangler.jsonc`: two `r2_buckets` entries, `ssn-tiles-local` and `ssn-uploads-local`, each with `local_dev.experimental_s3_credentials` set to the fixed local strings. `src/index.ts` returns 404. `package.json` script `dev`: `wrangler dev --port 8333 --ip 0.0.0.0 --persist-to ../../.data/wrangler`. Pin `wrangler` to the workspace version.
- `.gitignore` gains `.data/`. `packages/api/scripts/setup.sh` (`npm run setup`) deletes `.data/wrangler` and `.data/wrangler-e2e` under `--reset`, in the same step that drops the database.
- Contract test under `packages/local-r2/test/`: the spike's calls, run by `vitest` against a `wrangler dev` it starts itself (`unstable_dev` or a child process). It uses the real `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, and `aws-sdk` v2 from the workspace, at the client factory's settings. It is the tripwire for a `wrangler` upgrade renaming the experimental key.
- Local `.env` values: `R2_ENDPOINT=http://localhost:8333/cdn-cgi/local/r2/s3`, `R2_TILES_BUCKET=ssn-tiles-local`, `SPATIAL_UPLOADS_BUCKET=ssn-uploads-local`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` as in the config, `UPLOADS_BASE_URL=http://localhost:8788`, `TILES_BASE_URL=http://localhost:8787`, `TILES_ACL_NAMESPACE=local`.

### `pmtiles-server`

- `src/index.ts` line ~82: `const uploadsHost = url.hostname === "uploads.seasketch.org"` becomes a comparison of `url.host` against `env.UPLOADS_HOST ?? "uploads.seasketch.org"`, accepting a comma-separated list.
- Local bucket names without touching production config: an `[env.local]` block whose `r2_buckets` entry uses `bucket_name = "ssn-tiles-local"`, started with `wrangler dev --env local`. Confirm in the spike that local mode keys the persisted bucket by `bucket_name`; it did for `packages/local-r2`.
- Two `dev.config.mjs` entries: `pmtiles-tiles` on 8787 with the `overlay-data-tables` service binding, `pmtiles-uploads` on 8788 with `UPLOADS_HOST=localhost:8788`, both `--persist-to .data/wrangler`, both `--ip 0.0.0.0`, `JWKS_URL` at the local API, `AUTH_ACL_ENABLED=false`.

### Spatial uploads container

- `packages/spatial-uploads-handler/Dockerfile` splits into a runtime stage (GDAL, PROJ, GEOS, HDF5, NetCDF, tippecanoe, go-pmtiles, rclone, unrar, fiona, rasterio) and an application stage that starts `FROM ghcr.io/seasketch/spatial-uploads-runtime:<tag>` and copies `dist/`.
- A workflow builds and pushes the runtime stage when its Dockerfile section changes. Pin by digest or tag in the application stage (open question in the record; digest is safer, tag is easier).
- The production Lambda image build in the deploy workflow starts from the same published runtime image.
- `compose.yaml`: service `spatial-uploads` in the `data` profile, port 9001, `develop.watch` syncing `dist/` with restart, `extra_hosts: host.docker.internal:host-gateway`, environment from the local values plus `STORAGE_ORIGIN_MAP=http://localhost:8333=http://host.docker.internal:8333,http://localhost:8787=http://host.docker.internal:8787,http://localhost:8788=http://host.docker.internal:8788`, and the database URL on the host.
- `remotes.ts` and the handler's HTTP fetches apply `STORAGE_ORIGIN_MAP` before connecting. In production the variable is empty.
- `dev.config.mjs`: `spatial-uploads-tsc` runs `tsc -b --watch` for the package on the host; the existing host-mode server becomes an `--only spatial-uploads-host` opt-in.
- The API's `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER` default is `http://localhost:9001/2015-03-31/functions/function/invocations`, injected by `npm run dev` the way `SCREENSHOTTER_URL` is.

### ElasticMQ and subdivision

- `compose.yaml`: `elasticmq` (`softwaremill/elasticmq-native`, 9324) with a committed `elasticmq.conf` defining `overlay-engine-results` and the e2e queue. The existing `workers` profile folds into `data`.
- API: `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL` local default `http://localhost:9324/000000000000/overlay-engine-results`; the consumer in `src/overlayEngine/messageQueueConsumer.ts` honors `SQS_ENDPOINT`. New `SUBDIVISION_WORKER_DEV_HANDLER` used by `packages/api/tasks/preprocessSource.ts` under the dev-handler rule, default `http://localhost:9000/2015-03-31/functions/function/invocations`.
- `packages/subdivision-worker/lambda_handler.py`: `SQS_ENDPOINT` for the boto3 SQS client; fall back to `AWS_REGION` when the queue URL is not an AWS URL; `UPLOADS_BASE_URL` in place of `R2_PUBLIC_BASE_URL`; `STORAGE_ORIGIN_MAP`; always report `url` and `remote`.

### Startup, templates, manifest, journey

- `scripts/dev.config.mjs`: `local-r2`, `pmtiles-tiles`, `pmtiles-uploads`, `spatial-uploads-tsc`, readiness probes (`GET /cdn-cgi/local/r2/s3/` for `local-r2` returns an S3 error document, which is enough), dependencies (API after `local-r2` and `elasticmq`; Workers after the API for JWKS). `npm run dev` runs core plus data; `--profile core` opts out; `--ci` starts the data services once without watchers; the e2e profile uses offset ports and `.data/wrangler-e2e`.
- `.vscode/tasks.json`: `Dev: stack` unchanged; add `Dev: core only`.
- `packages/api/env-manifest.json`: new variables with classes per the record's configuration table. The CI check rejects every production-override value.
- Environment templates and `README.md` operating instructions.
- `packages/e2e`: a spatial-upload journey that uploads a small FlatGeobuf through the UI and asserts a tile request to `localhost:8787` succeeds. Runs in the Smoke or a new data job without cloud credentials.
- Mark the phase 1 exit criterion in the record when a clean machine passes it.

## Phase 2

- Overlay worker: `server.ts` port 3006 → 3007; `SQS_ENDPOINT`; per-origin pools; token rule (no `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` outside production means no header, one log line); clipping sources as URLs. `OVERLAY_WORKER_DEV_HANDLER` injected by `npm run dev`.
- Data tables handler: its `.env` points at the local S3 API and `ssn-tiles-local`; confirm the tiles-host `pmtiles-server` serves the parquet through the `overlay-data-tables` service binding under `wrangler dev` (service bindings between two local sessions need `--persist-to` shared and the binding named in both configs; if that is awkward, run `overlay-data-tables` as a third session).
- Fragment worker: `packages/fragment-worker/src/server.ts` on 3008 reading a JSON Lambda event; `FRAGMENT_WORKER_DEV_HANDLER` in the four `sketches.ts` invocations; URLs, pools, token rule.
- Sketch preprocessing: `wrangler dev` on 8789 with `--persist-to .data/wrangler`; the client's two hardcoded URLs in `SketchEditorModal.tsx` and `GeographyAdmin.tsx` move to `REACT_APP_SKETCH_PREPROCESSING_URL` with the deployed URL as default; the Worker reads its own origin through the binding and others over HTTP; drop the `DEV` branch.
- Journeys: data-table import, a report card with overlay metrics, and sketch clipping against a geography that mixes a production EEZ with a local layer.
- Mark the phase 2 exit criterion, and the data-profile exit criterion in `local-services.md`.

## Open items carried from the record

- 0a: the R2 bucket name (`ssn-uploads` is the working name).
- 0b: subdivision message compatibility during deploy.
- 1: the laptop portion of the spike; `[env.local]` versus `preview_bucket_name`; runtime image pinned by digest or tag; whether to file the `aws-chunked` issue against Miniflare.
- 2: a local mode with tile access control on; containerizing the Node processors.
