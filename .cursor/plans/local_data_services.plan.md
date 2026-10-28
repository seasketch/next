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
  - id: phase-1-local-r2
    content: "Phase 1: packages/local-r2, .data/ persistence and reset, contract test. In review."
    status: in_progress
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

Each numbered item below is one pull request. Phase 0 is implemented and tested from a laptop against the real `ssn-spatial-uploads-tmp` bucket before production is switched. Deploy is manual, so merging does not cut over. The production switch is one hard cut of bucket name and client after both phase 0 pull requests are ready, then the verification checklist. Phase 1 and 2 items change no production behavior except where noted.

1. Phase 0a: raw uploads to R2. Merged and deployed, October 2026.
2. Phase 0b: the storage model. Merged and deployed, October 2026.
3. Phase 1: `packages/local-r2`, the `.data/` directory, and the contract test. In review.
4. Phase 1: `pmtiles-server` under `wrangler dev` as two sessions.
5. Phase 1: the spatial-uploads container (Dockerfile split, registry image, Compose service).
6. Phase 1: ElasticMQ and subdivision on local storage.
7. Phase 1: startup wiring, templates, manifest, data profile as default, upload journey in CI.
8. Phase 2: overlay worker, data tables, fragment worker, sketch preprocessing, journeys.

Items 4 to 6 can be developed in parallel against a local branch of item 7's `dev.config.mjs` changes, but merge in that order so each is startable on `master` when it lands. Each of 4 to 6 adds its own `dev.config.mjs` entries in the `data` profile as it lands; item 7 is what flips the default and fills the templates, so a developer on `master` between items opts in with `--profile data` and the `.env` values from the `local-r2` launcher's output.

## The laptop portion of the spike

The Miniflare S3 API was verified on a shared VM on 2026-10-27, and `npm test --workspace local-r2` now repeats those calls against a session it starts itself. What remains is laptop-specific and worth doing once before item 7 declares the phase done: a 3 GB presigned PUT, concurrent writes and reads across sessions, and throughput on a local SSD. Start `npm run dev --workspace local-r2` and drive the SDK at `http://localhost:8333/cdn-cgi/local/r2/s3` with the launcher's printed credentials; the original spike configuration is kept below for reference.

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

- `scripts/dev.config.mjs` already carries `data-tables` (3006), `spatial-uploads` (host mode, 3005), `subdivision` (Compose `--profile workers`, 9000), and `screenshotter` (8791) in the `core` profile, and `servicesInProfile("data")` returns core plus `data`. So the `data` profile is where new entries go until item 7 moves the data-path entries out of `core` and makes `data` the default.
- The API's dev-handler path (`tasks/processDataUpload.ts` `runLambda`) POSTs the event JSON to `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER` as-is and parses the JSON reply. The Lambda emulator's invoke URL takes exactly that, so pointing the variable at `http://localhost:9001/2015-03-31/functions/function/invocations` needs no API change. `beginFeatureLayerConversion.ts` uses the same variable.
- `pmtiles-server` runs two Workers from two config files in one session (`wrangler dev -c wrangler.toml -c wrangler.data-tables.toml`), both binding `TILES_BUCKET` with `bucket_name = 'ssn-tiles'` and `preview_bucket_name = 'ssn-tiles'`. `PUBLIC_HOSTNAME` is a required secret used by `tilesBackend.ts` for TileJSON URLs; `.dev.vars.example` sets it to `localhost:8787`.
- `packages/api/.env.template` has `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_FILE_UPLOADS_BUCKET`, but not `R2_TILES_BUCKET`, `SPATIAL_UPLOADS_BUCKET`, `UPLOADS_BASE_URL`, or `TILES_BASE_URL`. `env-manifest.json` has only `DATA_TABLES_LAMBDA_DEV_HANDLER` and `TILES_ACL_NAMESPACE` from the data path.
- `scripts/build-images.mjs` prebuilds the images CDK deploys and asserts its list matches the `DockerImageAsset` count in `packages/infra/lib`. The Dockerfile split in item 5 has to keep that inventory check passing.
- The spike's two `wrangler dev` sessions are gone; the contract test in item 3 replaces them.

### `packages/local-r2` and `.data/` (item 3, in review)

Landed on the branch, October 2026:

- `packages/local-r2/wrangler.jsonc`: `ssn-tiles-local` (`TILES_BUCKET`) and `ssn-spatial-uploads-tmp-local` (`SPATIAL_UPLOADS_BUCKET`), each with `local_dev.experimental_s3_credentials` = `local` / `local-r2-secret`. `config.mjs` parses that file so the launcher, the test, and `scripts/dev.config.mjs` read the port, credentials, and bucket names from one place. `src/index.js` answers `GET /health` (the readiness probe) and `GET /binding/<bucket>/<key>` (the contract test's read-through-binding check); everything else is 404. `bin/dev.mjs` runs `wrangler dev --ip 0.0.0.0 --port 8333 --persist-to <repo>/.data/wrangler`, overridable with `LOCAL_R2_PORT`, `LOCAL_R2_PERSIST_TO`, `LOCAL_R2_IP`, and prints the `.env` values. `wrangler` is pinned `^4.115.0`, the first release with the S3 API; the lockfile resolves it to the workspace's 4.151.3.
- `.gitignore` has `.data/`. `setup.sh --reset` removes `.data/wrangler` for the `seasketch` database and `.data/wrangler-<suffix>` for `seasketch_<suffix>`, so the e2e reset does not touch a developer's objects. Verified: a `--reset` dropped the database and removed `.data/wrangler` while leaving `.data/wrangler-e2e`.
- Contract test `test/s3-api.test.mjs` (`node --test`, no new dependency) starts its own `wrangler dev` on a free port with a temporary persistence directory: `HeadBucket` on both buckets and a 404 for an unknown one, a wrong-secret 403, SDK v3 streamed `PutObject` + `HeadObject` + ranged `GetObject`, the no-`WHEN_REQUIRED` failure as a tripwire, `lib-storage` multipart (12 MB, 5 MB parts), presigned PUT with CORS preflight and presigned GET, read-back through the R2 binding, `CopyObject` / `ListObjectsV2` / `DeleteObjects`, and aws-sdk v2 put/get/list/presign/delete. Runs in about two seconds; `npm test` at the root picks it up.
- `scripts/dev.config.mjs`: `local-r2` entry in the `data` profile, `ready: http-get://127.0.0.1:8333/health`; `localR2Dev` exported for item 7's injection.
- Also settled here: `wrangler dev` uses `preview_bucket_name` for the local bucket, so item 4 changes that value rather than adding `[env.local]`. Recorded in the record's open questions.

Not in this item: `.env.template` and manifest entries (item 7), anything the API does with the values. Until item 7, a developer opts in with `--profile data` and copies the launcher's printed values into `packages/api/.env`, plus `UPLOADS_BASE_URL=http://localhost:8788` and `TILES_BASE_URL=http://localhost:8787` once item 4 serves them.

### `pmtiles-server` (item 4)

- `wrangler.toml` and `wrangler.data-tables.toml`: `preview_bucket_name = 'ssn-tiles-local'`. Production `bucket_name` is untouched.
- `src/index.ts` line 82: `url.hostname === "uploads.seasketch.org"` becomes a check of `url.host` against `env.UPLOADS_HOST ?? "uploads.seasketch.org"`, split on commas. Add `UPLOADS_HOST?: string` to `src/env.d.ts`. Deployed Workers have no `UPLOADS_HOST`, so behavior is unchanged there.
- `package.json` scripts: `dev:tiles` = `wrangler dev -c wrangler.toml -c wrangler.data-tables.toml --ip 0.0.0.0 --port 8787 --persist-to ../../.data/wrangler --var PUBLIC_HOSTNAME:localhost:8787 --no-show-interactive-dev-session`; `dev:uploads` = the same two configs on 8788 with `--var UPLOADS_HOST:localhost:8788 --var PUBLIC_HOSTNAME:localhost:8788`. Both sessions load both configs so the `DATA_TABLES` service binding resolves in each; `overlay-data-tables` is internal and cheap to run twice. `JWKS_URL` comes from `.dev.vars` (the example already points at `127.0.0.1:3857`) or a `--var`. Keep the existing `dev` script as an alias of `dev:tiles`.
- `dev.config.mjs`: `pmtiles-tiles` (`ready: http-get://127.0.0.1:8787/health` or whatever the Worker answers 200 to; check `src/index.ts` for a health route and add one if there is none) and `pmtiles-uploads` on 8788, both `profiles: ["data"]`, both `dependsOn: ["api"]` for JWKS in `--ci`.
- Verify: upload nothing yet; put a small PMTiles and a FlatGeobuf into `ssn-tiles-local` with the SDK, then fetch TileJSON from 8787 and the raw archive from 8788 for the same key, and a ranged FlatGeobuf read from either.

### Spatial uploads container (item 5)

- `packages/spatial-uploads-handler/Dockerfile`: the `gdal` stage and the tool installs (tippecanoe 2.64.0, go-pmtiles 1.8.0, rclone, unrar, fiona, rasterio) become a runtime image, `ghcr.io/seasketch/spatial-uploads-runtime`, built by a new workflow on changes to a `Dockerfile.runtime`. The application Dockerfile starts `FROM` that image, copies the workspace manifests and `dist/`, and installs production dependencies. Pin by digest in the application Dockerfile (the record's open question; digest is the safer default and the workflow can print the new digest in its summary).
- `scripts/build-images.mjs`: the `spatial-uploads-handler` entry keeps building the application image; the inventory assertion is unchanged because the CDK asset count does not change. `packages/infra/lib/UploadHandlerLambdaStack.ts` keeps `DockerImageCode.fromImageAsset` with the same file.
- `compose.yaml`: `spatial-uploads` service, `profiles: ["data"]`, built from the application Dockerfile with context `.`, `ports: 9001:8080`, healthcheck like `subdivision`'s, `develop.watch` with `sync+restart` from `packages/spatial-uploads-handler/dist` to the image's `dist/`, `extra_hosts: ["host.docker.internal:host-gateway"]`, and environment: `R2_ENDPOINT=http://localhost:8333/cdn-cgi/local/r2/s3`, the local credentials, `R2_TILES_BUCKET`, `SPATIAL_UPLOADS_BUCKET`, `BUCKET`/`TILES_REMOTE`/`RESOURCES_REMOTE` as the Lambda gets them (check `UploadHandlerLambdaStack.ts` for the full list), `UPLOADS_BASE_URL`, `TILES_BASE_URL`, `PGHOST=host.docker.internal` with the dev database credentials, and `STORAGE_ORIGIN_MAP=http://localhost:8333=http://host.docker.internal:8333,http://localhost:8787=http://host.docker.internal:8787,http://localhost:8788=http://host.docker.internal:8788`.
- `src/remotes.ts`: build `r2Client` through a small `applyOriginMap(url)` so the container reaches `localhost:8333` as `host.docker.internal:8333`; apply the same map in any `fetch` of a storage URL in `handleUpload.ts`. Empty map is a no-op; production sets none.
- `dev.config.mjs`: `spatial-uploads-tsc` (`npm run watch` in the package, host) and `spatial-uploads` becomes the Compose service with the same two-command pattern `subdivision` uses (`up -d --wait` then `watch --no-up`), `ready: tcp:127.0.0.1:9001`, `profiles: ["data"]`. The present host-mode entry is renamed `spatial-uploads-host` and kept as an opt-in with `ciCommand` removed.
- Verify: `POST` the emulator URL with a recorded `SpatialUploadsHandlerRequest` whose staged object is in `ssn-spatial-uploads-tmp-local`; outputs land in `ssn-tiles-local` with `localhost:8787` / `8788` URLs.

### ElasticMQ and subdivision (item 6)

- `compose.yaml`: `elasticmq` (`softwaremill/elasticmq-native`, `9324:9324`), `profiles: ["data"]`, with a committed `packages/api/elasticmq.conf` (or `infra/local/elasticmq.conf`) defining `overlay-engine-results` and `overlay-engine-results-e2e`. Move `subdivision` from `profiles: ["workers"]` to `["data"]` and update the two `docker compose --profile workers` commands in `dev.config.mjs`.
- API: `src/overlayEngine/messageQueueConsumer.ts` and wherever the SQS client is constructed take `SQS_ENDPOINT`; local default for `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL` is `http://localhost:9324/000000000000/overlay-engine-results`. New `SUBDIVISION_WORKER_DEV_HANDLER` in `tasks/preprocessSource.ts`: when set, POST `payloadForLambda` to it and treat a non-2xx as the Lambda failure path; otherwise the existing ARN invoke. Default injected by `npm run dev`: `http://localhost:9000/2015-03-31/functions/function/invocations`.
- `packages/subdivision-worker/lambda_handler.py`: `_get_sqs_client` honors `SQS_ENDPOINT` (`endpoint_url=`) and falls back to `AWS_REGION` when `_extract_region_from_sqs_url` returns `None`; `_create_r2_client` already sets path style; rename `R2_PUBLIC_BASE_URL` to `UPLOADS_BASE_URL` in the handler and in `packages/infra/lib/SubdivideWorkerLambdaStack.ts`; apply `STORAGE_ORIGIN_MAP` to the R2 endpoint and any HTTP fetch. Compose gives it `SQS_ENDPOINT=http://elasticmq:9324`, the local storage values, and the origin map.
- Verify: run a subdivision through `preprocessSource` against a local FlatGeobuf; the API's consumer receives the progress and completion messages from ElasticMQ and the outputs are in `ssn-tiles-local`.

### Startup, templates, manifest, journey (item 7)

- `scripts/dev.mjs` + `dev.config.mjs`: default profile becomes `data`; `data-tables`, `spatial-uploads`, `spatial-uploads-tsc`, `subdivision`, `local-r2`, `pmtiles-tiles`, `pmtiles-uploads`, `elasticmq` carry `profiles: ["data"]`; `core` is API, watchers, client, screenshotter. `envFor` injects into the API, when the matching service is selected and the variable is not already set: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_TILES_BUCKET`, `SPATIAL_UPLOADS_BUCKET` (from `localR2Dev` / `packages/local-r2/config.mjs`), `UPLOADS_BASE_URL`, `TILES_BASE_URL`, `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER`, `SUBDIVISION_WORKER_DEV_HANDLER`, `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL`, `SQS_ENDPOINT`. `startCompose` already passes `--profile data`. `client.dependsOn` in `--ci` gains the new services. `status.mjs` lists the default profile instead of `core`.
- e2e profile: `LOCAL_R2_PERSIST_TO=.data/wrangler-e2e`, `LOCAL_R2_PORT` offset, offset `pmtiles-server` ports, and the e2e queue, through `e2eEnv` on each entry; `scripts/e2e.mjs` already runs `setup --reset` with `SEASKETCH_DB_NAME=seasketch_e2e`, which now clears `.data/wrangler-e2e`.
- `.vscode/tasks.json`: `Dev: stack` unchanged; add `Dev: core only` running `npm run dev -- --profile core`.
- `packages/api/.env.template`: the local storage block (values from the `local-r2` launcher output), `UPLOADS_BASE_URL`, `TILES_BASE_URL`, and commented production overrides. `env-manifest.json`: entries for each with classes per the record's configuration table, and `forbidden` rows for the production endpoint, bucket names, base URLs, and `SPATIAL_UPLOADS_LAMBDA_ARN` / `SUBDIVISION_WORKER_LAMBDA_ARN` / `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL` on `amazonaws.com`.
- `README.md` operating instructions and `design-docs/dev-environment/local-services.md` profile note.
- `packages/e2e`: a spatial-upload journey that uploads a small FlatGeobuf through the UI and asserts the layer's tile request to `localhost:8787` returns 200. Runs in the smoke job without cloud credentials; the job gains the Docker image pull for the runtime image.
- Mark the phase 1 exit criterion in the record when a clean machine passes it.

## Phase 2

- Overlay worker: `server.ts` port 3006 → 3007; `SQS_ENDPOINT`; per-origin pools; token rule (no `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` outside production means no header, one log line); clipping sources as URLs. `OVERLAY_WORKER_DEV_HANDLER` injected by `npm run dev`.
- Data tables handler: its `.env` points at the local S3 API and `ssn-tiles-local`; confirm the tiles-host `pmtiles-server` serves the parquet through the `overlay-data-tables` service binding under `wrangler dev` (service bindings between two local sessions need `--persist-to` shared and the binding named in both configs; if that is awkward, run `overlay-data-tables` as a third session).
- Fragment worker: `packages/fragment-worker/src/server.ts` on 3008 reading a JSON Lambda event; `FRAGMENT_WORKER_DEV_HANDLER` in the four `sketches.ts` invocations; URLs, pools, token rule.
- Sketch preprocessing: `wrangler dev` on 8789 with `--persist-to .data/wrangler`; the client's two hardcoded URLs in `SketchEditorModal.tsx` and `GeographyAdmin.tsx` move to `REACT_APP_SKETCH_PREPROCESSING_URL` with the deployed URL as default; the Worker reads its own origin through the binding and others over HTTP; drop the `DEV` branch.
- Journeys: data-table import, a report card with overlay metrics, and sketch clipping against a geography that mixes a production EEZ with a local layer.
- Mark the phase 2 exit criterion, and the data-profile exit criterion in `local-services.md`.

## Open items carried from the record

- 0b: decided. Deploy order is in the record under *Phase 0b deploy order*. Workers and Lambdas first, then migrations, API, and client.
- 1: `preview_bucket_name` decided (item 3). Still open: the laptop portion of the spike (3 GB presigned PUT, ten consecutive uploads with concurrent reads, throughput); runtime image pinned by digest or tag; whether to file the `aws-chunked` issue against Miniflare.
- 2: a local mode with tile access control on; containerizing the Node processors.
