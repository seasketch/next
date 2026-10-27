# Local data services

> Part of the [2026 campaign record](README.md). Status: proposed architecture, October 2026. Awaiting review. An implementation plan follows acceptance.

[Index](README.md) · [Strategy](strategy.md) · [Local services](local-services.md) · [Service inventory](service-inventory.md)

## Intent

A developer or agent runs `npm run setup` and `npm run dev` on a clean machine, with a `.env` that holds little more than a Mapbox token, and gets a SeaSketch where the whole data path is local: upload a spatial layer, see it on the map served from local storage, prepare it for analysis, run overlay metrics in a report against it, and clip sketches to a shoreline or to a geography built from locally uploaded layers. No production credentials, no AWS or Cloudflare account, and nothing a local run does can touch a production object, queue, or Lambda.

Pointing one integration at its deployed counterpart stays possible, per integration, for someone debugging production. It is an explicit override and never the default.

Records that already point at production storage keep working after a machine switches to local storage, because every stored reference says where its object lives. Storage location is a property of the record, not of the process reading it.

This document is the architecture for the *data profile* that [local services](local-services.md) and [strategy](strategy.md) phase 3 call for. It refines those documents rather than replacing them: where this file is more specific, it is the record for the data path.

## Glossary

- **R2** — Cloudflare's object store. From inside a Worker it is reached through a *binding* (`env.BUCKET.get(key)`); from anywhere else it is reached through its S3-compatible HTTP API with an account-specific endpoint.
- **Miniflare** — the local simulator that `wrangler dev` runs Workers in. It provides local R2, KV, D1, and queue bindings backed by files under a persistence directory. It does **not** expose an S3 endpoint; local R2 is reachable only through bindings.
- **RIE** — the AWS Lambda Runtime Interface Emulator, a small server AWS ships inside its Lambda base images. Running a Lambda container image locally with RIE gives an HTTP endpoint (`POST /2015-03-31/functions/function/invocations`) that delivers the posted JSON to the handler exactly as Lambda would. `packages/subdivision-worker` already runs this way in `compose.yaml`.
- **GHCR** — the GitHub Container Registry (`ghcr.io`), an image registry attached to the GitHub organization that GitHub Actions can push to with its default token. Proposed here as the place to publish the prebuilt GDAL runtime image so neither laptops nor CI compile it.
- **ElasticMQ** — an SQS-compatible message queue server that runs as one container with no credentials.

## Scope

**In scope.** Object storage for raw uploads, tile archives, FlatGeobufs, GeoTIFFs, parquet, and ACL documents; tile and download serving; the spatial-uploads handler; the subdivision worker; the data-tables handler; the overlay worker and the result queue the API consumes; the fragment worker; the sketch-preprocessing worker; the data-model rule that makes storage references location-independent; the API, client, and infrastructure changes that let all of them run against local endpoints; startup, persistence, reset, and CI integration; and a staged migration of the remaining S3 buckets to R2.

**Out of scope.** Third-party products the app renders through: Mapbox, Google and ArcGIS basemap tiles, Cloudflare Images, Unsplash, Auth0, taxonomy APIs. A developer still needs a Mapbox token. The PII classifier Lambda and the AI data analyst remain unavailable when unset, as the rules already require. The public uploads bucket (`PUBLIC_S3_BUCKET`: sprites, consent documents, style uploads, forum attachments) and offline tile packages (`TILE_PACKAGES_BUCKET`) are not wired locally by this plan; they appear only in the migration section as later candidates for the same pattern.

**Public reference data stays public.** Shoreline clipping keeps reading the OSM land FlatGeobuf and H3 land archives from `uploads.seasketch.org` and `tiles.seasketch.org`, and the golden snapshot's fixture layers (data library templates, `demo-samoa` geographies) keep their production URLs. Anonymous reads of immutable public objects are allowed in every profile ([local services](local-services.md), *Rules*). What has to work is *mixing*: a geography may clip by a production-hosted EEZ and a locally uploaded layer in the same operation, and a project may hold layers from both.

## Starting point (October 2026)

[Service inventory](service-inventory.md) is the full table. The facts that shape this design:

- **Object storage has no local stand-in.** Raw uploads go to the `DataUploads` S3 bucket by presigned browser PUT; every output (tile archives, FlatGeobufs, GeoTIFFs, parquet, ACL documents, subdivided sources) is written to the `ssn-tiles` R2 bucket through the S3 API. Nothing in a local run can be written anywhere but production storage, so a local upload is impossible without production credentials.
- **Every writer speaks the S3 protocol.** The API presigns with aws-sdk v2 (`dataUploadTaskPlugin`, `overlayDataTablePlugin`, `replacePMTilesPlugin`), writes ACL documents and deletes objects with aws-sdk v2 against `R2_ENDPOINT`; the spatial-uploads and data-tables handlers write with SDK v3 (`remotes.ts`, multipart above 500 MB via `@aws-sdk/lib-storage`); the subdivision worker writes with boto3. Nothing writes through an R2 binding. Only two Workers read through bindings: `pmtiles-server` and the sketch-preprocessing worker, and both call only `get` and `head`.
- **Stored references are mostly fully qualified already.** `data_sources.url` and `data_upload_outputs.url` are complete URLs. `data_upload_outputs.remote`, `overlay_data_tables.parquet_remote` and its siblings are `r2://<bucket>/<key>` or `s3://<bucket>/<key>`. `deleted_geojson_objects` stores bucket and key. What is *not* location-independent is code: `overlayDataTablePlugin` turns `parquet_remote` into query and download URLs by prefixing a constant `https://uploads.seasketch.org`; `data_layers_vector_object_key` strips scheme and bucket from the FlatGeobuf output's `remote` and the API hands that bare key to the fragment and overlay workers and the sketch-preprocessing worker, each of which prefixes the same constant host; `JobStatusUpdater` falls back to that host when a result lacks a public URL; `GeographyPlugin.getBoundsForClippingLayer` decides how to read a layer by testing for `tiles.seasketch.org` in its URL; the overlay and fragment workers hold an undici `Pool` bound to that one host. [Second install](second-install.md) lists these literals as debt left alone; the data path cannot run locally without the part of it that builds data URLs.
- **Result delivery for overlay and subdivision is SQS.** The API's `messageQueueConsumer` receives *and deletes* messages from `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL`; workers post to the queue URL in their payload. Today's development setup uses a shared AWS queue, which needs AWS credentials and lets two developers' APIs take each other's results.
- **Worker authentication reads AWS Secrets Manager.** Overlay, fragment, and subdivision workers fetch a JWT via `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` and throw when it is unreachable. The API already skips this token when the ARN is unset outside production (September 2026); the workers do not.
- **Local entry points are uneven.** Spatial uploads has a host dev server (port 3005) and a production Docker image that takes tens of minutes to build (GDAL, PROJ, GEOS, HDF5, NetCDF from source). The overlay worker's host server is on 3006, the data-tables handler's port. The subdivision container exists in Compose but the API only knows `SUBDIVISION_WORKER_LAMBDA_ARN`. The fragment worker is Lambda-only. `pmtiles-server` has a `wrangler dev` recipe nobody starts, bound to real R2. The sketch-preprocessing worker's URL is hardcoded in two client components.
- **Startup is in place.** `npm run dev` (`scripts/dev.mjs`, `scripts/dev.config.mjs`) runs Compose for containers and `concurrently` for host processes, with `--profile`, `--ci`, `--only`, readiness probes, `.logs/`, `npm run status`, and the `Dev: stack` VS Code task. `envFor` already injects `SCREENSHOTTER_URL` into the API when it starts the local screenshotter. The `data` Compose profile is declared and empty.
- **Reset is a database operation.** `npm run setup -- --reset` restores the golden snapshot. There is no object store to reset.

## Rules

These apply [local services](local-services.md) rules to the data path and add three.

**Resolve each integration from the environment, in this order.** (1) A *deployed-target* variable is set — a Lambda ARN, an `https://…amazonaws.com` queue URL, a Cloudflare R2 endpoint, a `*.workers.dev` URL. Use it with the ambient AWS or Cloudflare credentials; the start command does not start the local counterpart. This is the production override; the CI profile forbids these values. (2) An explicit *local-target* variable is set — a `*_DEV_HANDLER` URL, a local storage endpoint. Use it; the start command assumes something else is serving it. (3) Neither is set. `npm run dev` starts the local service and injects its default URL into the processes that call it. An API started outside `npm run dev` with nothing set keeps today's behavior: the feature is unavailable.

**Local is the default.** `npm run dev` with an empty `.env` starts the data path. The lighter stack is the opt-out: `npm run dev -- --profile core`.

**Fidelity over convenience.** Where a local component can be the production artifact (the same container image, the same Worker code under `wrangler dev` with the same bindings, the same SDK calls to a different endpoint), it is. Substitutes are used only where the production artifact cannot run on a laptop, and each is listed in *Fidelity* below. Code paths that exist only for local runs are configuration, not branches.

**Stored references are self-describing.** A URL column holds a complete URL. A remote column holds `scheme://bucket/key`, and bucket names are unique across every store a process can see, so the bucket names the store. No code derives a URL from a key, or a key from a URL, by assuming a host; it reads the stored URL, or asks the store registry (below) what a bucket's public origin is. Base-URL and remote variables say where *new* objects go; they never say where existing objects are.

**Prefer R2.** New buckets are R2. Where a service still uses an S3 bucket, the plan includes the step that moves it, and local emulation does not add fidelity work for S3 that the migration would throw away.

## Architecture

### Topology

Everything below runs on one machine. Containers are Compose services in the root `compose.yaml`; host processes are entries in `scripts/dev.config.mjs`. Ports are defaults; each is a variable.

```
Browser ── client :3000 ─┬─ API :3857 (GraphQL, graphile-worker, SQS consumer)
                         │     │
                         │     ├─ presigned PUT, ACL docs, deletes ─► S3 gateway Worker :8333 (wrangler dev) ─┐
                         │     ├─ invoke ─► spatial-uploads :9001 (container, RIE) ── S3 API ─────────────────┤
                         │     ├─ invoke ─► subdivision     :9000 (container, RIE) ── S3 API, SQS ───────────┤
                         │     ├─ POST   ─► data-tables     :3006 (host)            ── S3 API ─────────────────┤
                         │     ├─ POST   ─► overlay worker  :3007 (host)            ── SQS                     │
                         │     ├─ POST   ─► fragment worker :3008 (host)                                       │
                         │     └─ receive ◄─ ElasticMQ :9324 (container, SQS API)                              │
                         │                                                                                     ▼
                         │                                                        local R2 (Miniflare, shared persist dir)
                         │                                                        buckets: ssn-tiles-local, spatial-uploads-local
                         │                                                                                     ▲
                         ├─ tiles, TileJSON, parquet ─► pmtiles-server :8787 (wrangler dev, tiles role) ── R2 binding ─┤
                         ├─ FlatGeobuf, archives ─────► pmtiles-server :8788 (wrangler dev, uploads role) ── R2 binding ┤
                         ├─ clip, warm-cache ─────────► sketch-preprocessing-worker :8789 (wrangler dev) ── R2 binding ─┘
                         └─ public reference data ───► uploads.seasketch.org, tiles.seasketch.org (anonymous reads, unchanged)
```

The existing core services (Postgres 54321, Redis 6379, API, client, watchers, screenshotter 8791) are unchanged. The e2e profile gets its own `wrangler dev` sessions on offset ports with their own persistence directory, following the pattern the screenshotter already uses (8791/8792); the Compose containers are shared.

### Object storage: local R2 under Miniflare

**Local R2 is the system of record.** Every `wrangler dev` session in the data profile (`pmtiles-server` twice, the sketch-preprocessing worker, the S3 gateway) is started with the same `--persist-to <repo>/.data/wrangler/` directory, which is how Cloudflare documents sharing bindings between sessions. All of them see the same two R2 buckets. The Workers that read in production through R2 bindings read locally through the same bindings, unmodified. That is a better fidelity position than the previous draft's S3-compatible container, which would have required an R2-shaped shim inside those Workers.

**Bucket names are local-specific.** The local buckets are `ssn-tiles-local` and `spatial-uploads-local`, set through each Worker's `preview_bucket_name` (or a `[env.local]` block; the implementation plan picks whichever `wrangler dev` honors in local mode). A `remote` of `r2://ssn-tiles/…` therefore always means production, and `r2://ssn-tiles-local/…` always means this machine, which is what lets a database carry both. Key layout under the bucket is production's (`projects/<slug>/public/…`, `projects/<slug>/subdivided/…`, `acl/<ns>/projects/<slug>.json`, data-library prefixes), so `pmtiles-server`'s `classifyResource` and `isTilePresentationKey`, the cleanup tasks, and the ACL document paths run unmodified.

**Writers reach local R2 through a local S3 gateway Worker.** Miniflare exposes R2 only to Workers; it has no S3 endpoint. Every production writer uses the S3 protocol, and in production that is also how they reach R2 (R2 from outside a Worker *is* its S3 API). The local counterpart is a small Worker, `packages/local-s3-gateway`, run under `wrangler dev` on 8333 with one binding per local bucket, that accepts path-style S3 requests and performs them on the binding: `PutObject`, `GetObject` with `Range`, `HeadObject`, `DeleteObject`, `DeleteObjects`, `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`, and CORS preflight. It does not verify SigV4 signatures; it checks that a presigned URL's `X-Amz-Expires` has not passed and that the `Content-Type` matches what was signed, which is the mistake presigning actually makes. Everything else S3 offers is a `501`. Writers are configured by endpoint only (`S3_ENDPOINT`/`R2_ENDPOINT=http://localhost:8333`, path-style, placeholder credentials), so no writer code knows the gateway exists. The gateway is local-only code and the single largest piece of it; it is bounded by the operation list above, and a contract test runs each writer's real SDK calls against it.

**Where Miniflare behind a gateway may be off from S3 or R2, and whether it matters:**

| Gap | Effect | Position |
| --- | --- | --- |
| No signature verification | A broken presign (wrong key, wrong region, wrong header set) succeeds locally and fails in production | Accepted for the default profile; the gateway's expiry and content-type checks cover the common mistake. A journey against the deployed presign path belongs to the production probe, not local. |
| S3 bucket features: lifecycle expiry on `DataUploads` (7 days), bucket policies, versioning | Not emulated | Lifecycle is a cost control, not behavior under test. Once raw uploads move to R2 (migration step 1) it becomes an R2 lifecycle rule and the gap closes. |
| ETag format for multipart, `x-amz-*` response headers | The gateway synthesizes them from `R2Object` fields | No caller inspects them beyond `lib-storage`'s part bookkeeping; covered by the contract test. |
| Throughput: a multi-GB upload streams through workerd twice (gateway write, handler read) | Possibly slower than a native store | Unmeasured; a spike item. Miniflare's blob store writes to disk, so memory is not the limit. |
| Several workerd processes on one SQLite-backed persistence directory | Cloudflare recommends it; lock contention under concurrent writes is possible | Spike item. The fallback is one multi-config `wrangler dev` session hosting every Worker, which guarantees one Miniflare instance but exposes only the primary Worker over HTTP, so the others would need to be reached by path through it — a local-only routing layer this plan would rather avoid. |
| `ListObjectsV2` | Not implemented in the gateway | No current writer lists. If one appears, the binding's `list` makes it a small addition. |
| R2 binding differences from real R2 (conditional headers, checksum options) | Miniflare tracks the production binding closely; residual differences are Cloudflare's to fix | Same exposure every Workers project has. |

**Persistence directory.** `.data/` at the repo root, gitignored, owned by the developer's user (no root-owned files, since no container writes it). It holds `wrangler/` for the shared Miniflare state and `wrangler-e2e/` for the e2e profile.

**Bucket creation is implicit.** Miniflare creates a bucket on first use of its binding. There is no bucket setup step and no CORS configuration object: the gateway answers preflight itself with the same rule `DataUploadsStack` declares (`PUT`, `GET`, `HEAD`, any origin, any header).

### Storage references in the data model

The second note in review asked whether records can be stored in multiple places without a global base URL deciding where they are. Yes, and most of the schema already does it. This section is the rule and the registry that finish the job.

**What is already location-independent.** `data_sources.url` (the TileJSON or archive URL the client loads), `data_upload_outputs.url` (the download URL per output), and `data_upload_outputs.remote` (`scheme://bucket/key`) are complete. `overlay_data_tables.parquet_remote`, `column_stats_remote`, `source_parquet_remote`, and `coverage_remote` are bucket-qualified remotes. `deleted_geojson_objects` carries bucket and key. The fragment worker and sketch-preprocessing worker payloads are built at call time, not stored.

**What has to change.** Code, not columns:

- `data_layers_vector_object_key` (and the three `clipping_layers_for_*` functions that use it) return a bare key. They are replaced by a function that returns the FlatGeobuf output's `url`, and `sketches.ts`, `calculateSpatialMetricsBatch.parseClippingLayer`, and `GeographyPlugin` pass that URL to the workers. `GeographySettings.clippingLayers[].source` becomes a URL; the workers treat a value without a scheme as a legacy key on `https://uploads.seasketch.org` for one release, then drop that.
- `overlayDataTablePlugin`'s `remoteToPublicUrl`, `remoteToQueryUrl`, `remoteToOrgQueryUrl`, `remoteToTemporalPreviewUrl`, and `remoteToSiblingUrl` resolve the remote's bucket through the store registry instead of a constant host.
- `JobStatusUpdater` uses the public URL the worker reported, and when a legacy result carries only bucket and key, resolves them through the registry.
- `GeographyPlugin.getBoundsForClippingLayer` decides by the output's `type` (`PMTiles` → `${url}.json` or the overlay properties endpoint; `FlatGeobuf` → the FGB header), not by whether the URL contains `tiles.seasketch.org`.
- `metadataParserPlugin`, `replacePMTilesPlugin`, and `reportsPlugin` build new remotes and URLs from the registry entry for the *write target*, not from literals.
- The overlay worker, fragment worker, and `sketches.ts`'s `sourceCache` open one undici `Pool` per origin, on demand, keyed by the URL they are given.
- The subdivision worker reports `bucket`, `key`, and the public URL it was configured with, and the API stores the URL.

**The store registry.** A small module in the API (and a copy of the same table in the handlers and the subdivision worker, since they construct output URLs) that maps a bucket name to `{ kind: "r2" | "s3", endpoint, publicOrigin, tilesOrigin, credentials? }`. Production buckets are built in with their public origins and *no* credentials (`ssn-tiles` → `https://uploads.seasketch.org` / `https://tiles.seasketch.org`; the `DataUploads` bucket → no public origin, it is never read by URL). Local buckets are added from the environment (`ssn-tiles-local` → `http://localhost:8788` / `http://localhost:8787`, endpoint `http://localhost:8333`, placeholder credentials). A production override adds credentials to a production entry. Two consequences follow:

- *Reads need no registry.* A process reading a stored URL just fetches it. The registry is consulted only to build a URL from a remote (data tables), to write, or to delete.
- *Deletes are refused for stores without credentials.* A local database that contains production records (the golden snapshot's fixtures, or rows left from a developer's earlier production-pointed session) will, on layer deletion, enqueue cleanup of `r2://ssn-tiles/…`. The registry has no credentials for `ssn-tiles` locally, so the task logs and skips instead of failing or, with a stale `.env`, succeeding. This is a safety property today's code does not have.

**Write targets.** `TILES_REMOTE` and `RESOURCES_REMOTE` (which already exist in the handlers' environment) name the bucket new outputs go to; the registry supplies that bucket's origins for the URLs recorded beside them. `UPLOADS_BASE_URL` and `TILES_BASE_URL` stop being independent inputs and become fields of the write-target bucket's registry entry; the handler keeps reading them as variables for one release while callers are updated. Switching a machine from production storage to local, or back, changes the write target and nothing else; every existing row keeps resolving to wherever it was written.

**Golden snapshot.** No change. Its fixture rows reference `ssn-tiles` and `uploads.seasketch.org`; after this change a local database that mixes those rows with `ssn-tiles-local` rows is the normal case, not a special one.

### Tile and download serving

**`pmtiles-server` runs as two `wrangler dev` sessions**, because its behavior is selected by hostname and local URLs differ by port, not host. The literal `url.hostname === "uploads.seasketch.org"` becomes `url.host === (env.UPLOADS_HOST ?? "uploads.seasketch.org")`. The session on 8787 (tiles role, with the `overlay-data-tables` service binding) serves TileJSON, ZXY tiles, parquet queries, and previews; the session on 8788 is started with `UPLOADS_HOST=localhost:8788` and serves raw objects with range support, as the uploads host does in production. Both read local R2 through the normal `TILES_BUCKET` binding and share the persistence directory with the gateway. Both listen on `0.0.0.0` so containers can reach them. `JWKS_URL` points at the local API (the `.dev.vars.example` default already does). `AUTH_ACL_ENABLED` defaults to `false`, matching the deployed `wrangler.toml`; turning it on locally is a flag, so access-control journeys can exercise ACL documents before production enables them.

**ACL documents** are written by the API's `writeProjectAclDoc` (aws-sdk v2, through the gateway) to `acl/local/projects/<slug>.json` in `ssn-tiles-local`. `TILES_ACL_NAMESPACE=local` and the `envProfile` guard against `prod` stay in force unchanged.

### AWS SDK clients

**One client factory per runtime.** The API gets `src/aws/s3Client.ts` (aws-sdk v2 `S3` and SDK v3 `S3Client` constructors), `sqsClient.ts`, and `lambdaClient.ts`, and every ad hoc `new S3({ region })`, `new SQSClient(...)`, and `new Lambda(...)` moves onto them. The S3 factory takes a registry entry and sets `endpoint`, `s3ForcePathStyle` / `forcePathStyle`, and credentials from it. `SQS_ENDPOINT` (or `AWS_ENDPOINT_URL_SQS`) is read for the queue client. The handlers' `remotes.ts` and the subdivision worker's `_create_r2_client` make the same change in SDK v3 and boto3, mostly path-style, since those SDKs already read `AWS_ENDPOINT_URL*`.

**Presigned URLs are signed for the host the browser uses.** The API signs against `http://localhost:8333/spatial-uploads-local/<key>`; the browser PUTs to the same string. Containers that read the bucket use their own endpoint (`http://host.docker.internal:8333`) and sign their own requests.

**Lambda invocation keeps the dev-handler pattern.** `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER`, `OVERLAY_WORKER_DEV_HANDLER`, and `DATA_TABLES_LAMBDA_DEV_HANDLER` exist. `SUBDIVISION_WORKER_DEV_HANDLER` and `FRAGMENT_WORKER_DEV_HANDLER` are added with the same semantics: POST the Lambda event as JSON, read the response. For the two container workers the dev-handler URL is the RIE invoke URL, so the API sends exactly the event the deployed Lambda receives.

### Spatial uploads

**The production container is the default local handler.** The current host-mode `tsx watch server.ts` entry depends on a hand-installed GDAL, tippecanoe, and go-pmtiles whose versions drift from the image; re-evaluated against the fidelity goal, it is demoted to an opt-in. The default runs `packages/spatial-uploads-handler`'s own image under RIE as a Compose service (`spatial-uploads`, host port 9001), the same way `subdivision` runs today, with `develop.watch` syncing `dist/` and restarting the container while a host `tsc -b --watch` rebuilds it. `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER` is injected as the RIE invoke URL. The README already documents this recipe; it becomes the thing the start command does.

**The slow part of the image is prebuilt and shared with production.** The Dockerfile splits into a runtime stage (GDAL 3.9.2, PROJ, GEOS, HDF5, NetCDF, tippecanoe, go-pmtiles, rclone, unrar, fiona, rasterio — everything that takes tens of minutes) published to GHCR by a workflow that runs when that stage changes, and an application stage `FROM ghcr.io/seasketch/spatial-uploads-runtime:<digest>` that copies `dist/` and takes seconds. The production Lambda image is built from the same two stages, so the local handler and the deployed one run the same binaries. This also answers the open question in [local services](local-services.md) about image build time in pull-request CI: CI pulls the runtime layer.

**Container-facing configuration.** The service receives `S3_ENDPOINT`/`R2_ENDPOINT` as `http://host.docker.internal:8333`, `RESOURCES_REMOTE=r2://ssn-tiles-local`, `TILES_REMOTE=r2://ssn-tiles-local/…`, the registry's local entry (so the URLs it records are the browser-facing `localhost:8787`/`8788` ones), and `extra_hosts: host-gateway` so `host.docker.internal` resolves on Linux Docker Engine as it does on Docker Desktop. The Lambda database client (`lambda-db-client.ts`) reaches Postgres on the Compose network.

**Host mode stays available** as `npm run dev -- --only spatial-uploads-host` for someone iterating on the handler's TypeScript with the toolchain installed. It is not started by default and is not used in CI.

### Message queue

**ElasticMQ as a Compose service** (`softwaremill/elasticmq-native`, port 9324, SQS-compatible, in-memory, no credentials). The queue it hosts is defined in a committed `elasticmq.conf` as `overlay-engine-results`, with the e2e profile's queue beside it. The API's local `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL` default is `http://localhost:9324/000000000000/overlay-engine-results`.

A queue URL *names* the queue; the endpoint variable says where to send the request. The API's consumer, the overlay worker (host), and the subdivision worker (container) each get `SQS_ENDPOINT` for their own network position, and all of them can carry the same queue URL in payloads. The subdivision worker's region parsing (`sqs.<region>.amazonaws.com`) becomes a fallback to `AWS_REGION` when the URL is not an AWS one.

Message loss on container restart is acceptable: the queue carries job *progress* for jobs whose state of record is Postgres, and a job that misses its completion message is already handled as a timeout today. This settles the per-developer-AWS-queue versus emulator question in [local services](local-services.md) toward the emulator, because the alternative keeps AWS credentials in the default profile. Moving this queue to Cloudflare Queues would fit the *prefer R2* direction and is noted in the migration section; it is not part of this plan because the consumer is the API, which is not a Worker.

### Worker authentication

The overlay-engine access token exists so workers can read *private* hosted data and so `pmtiles-server` can trust them. Locally, `pmtiles-server` runs with ACL enforcement off by default, as production does today, and the token adds nothing. The workers adopt the API's existing rule: when `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` is unset outside production, send no `Authorization` header and log once; in production, throw `MisconfiguredError`. Secrets Manager is not emulated. For the ACL-on local mode, the API — which already mints these tokens (`mintOverlayEngineAccessToken`) — can hand a long-lived token to the local workers through an `OVERLAY_ENGINE_ACCESS_TOKEN` variable, which `dev.mjs` can mint at start by calling the API's signing code. That is an extension for whenever ACL-on journeys arrive, not part of the default profile.

### Overlay worker

Runs as it does now, host-side under `tsx watch`, moved to port 3007 so it no longer collides with the data-tables handler. Changes: per-origin pools; `SQS_ENDPOINT`; optional token; clipping sources as URLs. The `OVERLAY_WORKER_DEV_HANDLER` default is injected by `dev.mjs`. The worker's land and H3 inputs (`LAND_FLATGEOBUF_URL`, the `tiles.seasketch.org` archives) stay on their production public URLs. A developer who wants to test a modified shoreline sets those variables to a local upload's URL.

### Subdivision worker

The Compose service already exists. The API gains `SUBDIVISION_WORKER_DEV_HANDLER` with the RIE URL as its local default; `preprocessSource` uses it under the same resolution rule as the other handlers. The worker swaps `R2_PUBLIC_BASE_URL` for the registry's local entry, reads `SQS_ENDPOINT`/`AWS_ENDPOINT_URL_SQS`, and downloads its source from the URL in its payload, which the container can reach because `localhost:8788` in a stored URL is rewritten to `host.docker.internal:8788` by a `HOSTED_DATA_ORIGIN_MAP` of `publicOrigin=reachableOrigin` pairs set in `compose.yaml`. The same map is given to the spatial-uploads container. In production the map is empty and the code path is identity.

### Data-tables handler

Already a host process on 3006 and already parameterized by `TILES_REMOTE`. It receives the gateway endpoint and the registry's local entry; its parquet lands in `ssn-tiles-local` and is served by the tiles-role `pmtiles-server` through the `overlay-data-tables` binding, which is the production path. `TAXONOMY_PROXY_URL` is a third-party dependency and stays external.

### Fragment worker

Gets a `server.ts` like the overlay worker's: an HTTP server on 3008 that reads a JSON Lambda event and calls `lambdaHandler`, so the four invocations in `sketches.ts` go through `FRAGMENT_WORKER_DEV_HANDLER` with unchanged payloads. Clipping sources arrive as URLs; fetches use per-origin pools; its token follows the worker-authentication rule. Deployment is unchanged.

### Sketch-preprocessing worker

Runs under `wrangler dev` on 8789 against the shared persistence directory, reading through its existing `SSN_TILES` binding. The client's two hardcoded calls (`SketchEditorModal.tsx`, `GeographyAdmin.tsx`) move to `REACT_APP_SKETCH_PREPROCESSING_URL`, defaulting to the deployed URL, so the production client is unchanged; the local client `.env.template` points at 8789. Clipping sources arrive as URLs; for a URL whose origin is one of its own buckets' public origins it reads through the binding (production behavior for `uploads.seasketch.org` keys), and for any other origin it fetches. The `DEV` branch that fetched through the public host goes away.

### Client

Little changes. Layer, tile, and download URLs come from the database, so a local upload already renders from `localhost:8787`/`8788` once the API writes those URLs, and a production layer in the same project keeps rendering from `tiles.seasketch.org`. `isHostedDataHost` in `tilesAuth.ts`, which decides whether to attach a tiles-ACL token, already includes `localhost`; the preprocessing URL becomes a variable; `REACT_APP_TILES_ACL_NAMESPACE` stays `local`. The presigned upload flow in the browser is untouched.

### Configuration

The resolution rule in *Rules* is implemented in `dev.mjs`'s `envFor`, generalizing the `SCREENSHOTTER_URL` case: for each local service it starts, it injects the service's default URL into the processes that call it, unless the caller's `.env` already names a target. The table lists what an empty `.env` resolves to and what overrides it. New variables enter `packages/api/env-manifest.json` with the class shown; `envProfile`'s `seasketch.org` and CI checks forbid deployed values in CI.

| Integration | Local default (injected by `dev.mjs`) | Production override (set in `.env`, never in CI) | Manifest class |
| --- | --- | --- | --- |
| Storage endpoint | `S3_ENDPOINT=R2_ENDPOINT=http://localhost:8333`, placeholder `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`R2_*` keys, `AWS_REGION=us-west-2` | `R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com` with real keys; for the S3 bucket, unset `S3_ENDPOINT` with real AWS credentials | public-config / production-secret |
| Write targets | `SPATIAL_UPLOADS_BUCKET=spatial-uploads-local`, `R2_TILES_BUCKET=ssn-tiles-local`, `TILES_REMOTE=r2://ssn-tiles-local`, `RESOURCES_REMOTE=r2://ssn-tiles-local` | production bucket names | public-config |
| Store registry, local entry | `ssn-tiles-local` → uploads `http://localhost:8788`, tiles `http://localhost:8787` | not applicable — production entries are built in | public-config |
| Tiles and uploads serving | two `wrangler dev` sessions, `UPLOADS_HOST`, `AUTH_ACL_ENABLED=false`, `--persist-to .data/wrangler` | not applicable — the client follows URLs in the database | public-config |
| S3 gateway | `wrangler dev` on 8333, same persistence directory | not applicable | public-config |
| Spatial uploads | `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER=http://localhost:9001/2015-03-31/functions/function/invocations` | `SPATIAL_UPLOADS_LAMBDA_ARN` | public-config / production-secret |
| Subdivision | `SUBDIVISION_WORKER_DEV_HANDLER=http://localhost:9000/2015-03-31/functions/function/invocations` | `SUBDIVISION_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Data tables | `DATA_TABLES_LAMBDA_DEV_HANDLER=http://localhost:3006` (exists) | `DATA_TABLES_HANDLER_LAMBDA_ARN` | public-config / production-secret |
| Overlay worker | `OVERLAY_WORKER_DEV_HANDLER=http://localhost:3007` | `OVERLAY_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Result queue | `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL=http://localhost:9324/000000000000/overlay-engine-results`, `SQS_ENDPOINT=http://localhost:9324` | an `https://sqs.<region>.amazonaws.com/…` URL (the per-developer queues `SQSStack` provisions) | public-config / per-environment-name |
| Fragment worker | `FRAGMENT_WORKER_DEV_HANDLER=http://localhost:3008` | `FRAGMENT_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Sketch preprocessing | `REACT_APP_SKETCH_PREPROCESSING_URL=http://localhost:8789` | the `*.workers.dev` URL | public-config |
| Worker token | `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` unset — no header | the ARN, with AWS credentials | production-secret |
| Container-facing | set in `compose.yaml`: endpoints on `host.docker.internal`, `extra_hosts: host-gateway`, `HOSTED_DATA_ORIGIN_MAP=http://localhost:8788=http://host.docker.internal:8788,…` | not applicable | public-config |

A mixed configuration is legitimate: `SPATIAL_UPLOADS_LAMBDA_ARN` set and everything else local sends uploads through the deployed handler, which writes to production storage and records `ssn-tiles` remotes and production URLs. Those rows render and clip locally like any other production-hosted record, and the local cleanup task will refuse to delete their objects. The manifest's CI profile check rejects every value in the override column.

### Startup

- **`compose.yaml`** gains `elasticmq` and `spatial-uploads` in a `data` profile (the existing `workers` profile folds into it), each with a healthcheck and `extra_hosts`. No storage container.
- **`scripts/dev.config.mjs`** gains `s3-gateway`, `pmtiles-tiles`, `pmtiles-uploads`, `sketch-preprocessing`, `fragment-worker`, `spatial-uploads-tsc` (the host `tsc -b --watch` that feeds the container), and the moved `overlay-worker`, with `ready` probes and `dependsOn` edges (`api` waits for the gateway and queue; the Workers wait for the API for JWKS). `spatial-uploads` (host mode) stays as an opt-in entry.
- **Default profile.** `npm run dev` runs core plus data. `--profile core` is the opt-out. `--ci` starts the data services once, without watchers, as it does for the current handlers. The e2e profile adds the data services on offset ports with `--persist-to .data/wrangler-e2e` and its own queue, so a Playwright run can execute an upload journey beside a developer's own stack.
- **`npm run status`** lists the new ports; `npm run logs -- <service>` works for every entry; `.logs/` is unchanged.
- **VS Code.** `Dev: stack` already runs `npm run dev` and inherits the new default. A `Dev: core only` task is added for the opt-out. Tasks remain a convenience, not the contract ([environment setup](env-setup.md)).
- **Host requirements.** Docker and Node, as today. No GDAL, tippecanoe, Java, or Python on the host.

### Persistence and reset

Uploaded data survives restarts and is destroyed with the database.

- Local R2 lives in `.data/wrangler/` in the repository, gitignored, written by `wrangler dev` as the developer's user. It persists across `npm run dev` restarts and machine reboots.
- **`npm run setup -- --reset`** deletes `.data/wrangler/` in the same step that drops the database and restores the golden snapshot, so object storage and database rows are reset together and never disagree. Without `--reset`, `setup` leaves both alone.
- **CI** starts from a fresh checkout with no `.data/`; the e2e profile deletes `.data/wrangler-e2e/` at suite start, so a developer running `npm run e2e` locally gets the same clean slate.
- **The golden snapshot does not include objects.** Its fixture layers point at production public URLs, and that stays true. A later fixture that needs a *local* object (for example, a private layer for an access-control journey) is uploaded by the journey itself through the normal pipeline, per the rule in `AGENTS.md`.

### Fidelity

What differs from production in the default local profile, and why each is acceptable:

| Difference | Why it is acceptable |
| --- | --- |
| Miniflare's R2 instead of R2 | The Workers that read R2 run the same code against the same binding API. Cloudflare maintains the simulator against the production binding. |
| Writers reach R2 through the local S3 gateway instead of R2's S3 endpoint | Same SDK calls, same protocol subset; only the endpoint differs. Signatures are not verified (see the gap table). |
| HTTP, not HTTPS; `localhost` ports instead of hostnames | Transport only. The hostname-selected behavior in `pmtiles-server` is exercised through `UPLOADS_HOST`. |
| RIE instead of Lambda | Same image, same event, same handler entry point. RIE does not enforce the 15-minute timeout or memory limit; Compose `mem_limit` can approximate the latter. The API awaits the dev-handler call rather than firing an async `Event` invoke — existing behavior of the dev-handler path. |
| ElasticMQ instead of SQS | Same SDK calls. Messages are lost on restart; job state of record is Postgres. |
| No Cloudflare edge cache in front of `pmtiles-server` | Cache behavior is not under test locally. |
| Workers send no access token | Matches an ACL-off `pmtiles-server`, which is production's current setting. ACL-on local mode supplies a token. |
| Overlay worker, fragment worker, data-tables handler run as host Node processes under `tsx` rather than Lambda containers | Pure-Node code with no native toolchain; already the dev pattern for two of the three. Containerizing them is possible later with the RIE recipe if a Node-version or dependency discrepancy ever bites. |
| Raw uploads land in local R2 while production's raw-upload bucket is still S3 | Closes when migration step 1 lands. Until then the difference is the bucket's provider, not the protocol the handler uses. |

## R2 migration

The remaining S3 buckets, in the order that pays back soonest. Each step is independent and production-deployable on its own. R2 from outside a Worker is its S3 API, so "off S3" here means off the S3 *service*; the Lambdas keep the S3 SDK, pointed at R2, as they already do for `ssn-tiles`.

1. **Raw spatial and data-table uploads: `DataUploads` (S3) → `spatial-uploads` (R2).** Changes: the API presigns against the R2 client instead of the region-only S3 client (`dataUploadTaskPlugin`, `overlayDataTablePlugin`, `replacePMTilesPlugin`); R2 bucket CORS copied from `DataUploadsStack`; a 7-day R2 lifecycle rule; the spatial-uploads and data-tables handlers read the raw object through their existing R2 client; `DataUploadsNormalized` follows the same way. After this, the API has one storage client kind, `S3_REGION` is unused on the data path, and the local gateway emulates only R2-via-S3, which is the production shape. **This is the step this plan recommends doing early**, ideally inside phase 1, because it removes an entire provider from the registry before anything else depends on it.
2. **Public uploads: `PUBLIC_S3_BUCKET` behind CloudFront at `PUBLIC_UPLOADS_DOMAIN` → an R2 bucket with a custom domain.** Sprites, consent documents, style uploads, and forum attachments. Same recipe; the stored URLs keep `PUBLIC_UPLOADS_DOMAIN`, so no row changes. This also brings those features into the local data profile for free, since they would write through the gateway.
3. **Offline tile packages: `TILE_PACKAGES_BUCKET` → R2.** Written by `createTilePackage`, served by presigned GET. Same recipe. R2 presigned GETs work through its S3 API.
4. **Result queue: SQS → Cloudflare Queues** is the natural end of the *prefer R2* direction, but the consumer is the API, which is not a Worker; it would need a pull consumer (Queues has an HTTP pull API) or a Worker that relays to the API. Not part of this plan; recorded so the ElasticMQ decision is understood as provisional.

Where the S3 protocol itself, rather than the S3 service, becomes the irritant — for example if the gateway's unverified signatures ever let a presign bug reach production — the next step would be a Worker-hosted write API with an R2 binding that the Lambdas call instead of the S3 SDK. That makes local and production identical and retires the gateway, at the cost of moving every writer. It is listed as a direction, not a plan.

## Phases

Both phases sit inside [strategy](strategy.md) phase 3 ("data profile") and the first items of phase 5 (sketch processing). Each phase is a set of pull requests that keep `master` deployable; the registry's production entries and the write-target defaults are production's values, so production behavior does not change until a profile sets them.

### Phase 1 — Spatial uploads for map visualization

**Goal.** On a clean machine with only a Mapbox token: `setup`, `dev`, sign in, upload a shapefile, GeoJSON, GeoTIFF, or FlatGeobuf, and see it on the map beside the project's existing production-hosted layers, with tiles and downloads served from local storage. Delete it and the objects are cleaned up. Restart and it is still there. `setup --reset` and it is gone.

**Components that change.** The local S3 gateway Worker and its contract test; `.data/` persistence and `setup --reset`; `compose.yaml` and `dev.config.mjs`; the store registry and the AWS client factories in the API and `remotes.ts`; the URL-construction sites uploads touch (`spatialUploads`, `JobStatusUpdater`, `replacePMTilesPlugin`, `metadataParserPlugin`, `writeProjectAclDoc`, the cleanup tasks with their refuse-without-credentials rule); the Dockerfile split and GHCR runtime image; the spatial-uploads Compose service with watch; `pmtiles-server`'s host variable, local bucket names, and two-session start; the manifest and templates; `README.md` instructions. The subdivision worker is pointed at local storage in this phase, because uploads larger than the preprocessing threshold enqueue it and its Compose service already exists; its progress messages need the queue, so **ElasticMQ lands at the end of phase 1** with only the subdivision producer and the API consumer on it. **Migration step 1** is scheduled here if review agrees; otherwise the gateway carries an `s3`-kind entry for `spatial-uploads-local` until it lands.

**Exit.** A fresh clone reaches a rendered local upload with the empty-`.env` path, in a project that also shows the fixture production layers. The upload journey from the phase 3 bundler-risk list runs in the e2e profile in CI. `npm run status` shows every data service. A developer who sets `SPATIAL_UPLOADS_LAMBDA_ARN` and real credentials gets the deployed handler and nothing else changes. No production hostname literal remains in the API's upload path.

### Phase 2 — Reporting and sketch processing

**Goal.** Create a geography from locally uploaded clipping layers (and from production EEZ data), draw a sketch, see it clipped and its fragments created locally, and run a report whose overlay metrics are computed by the local overlay worker against local data tables and local layers.

**Components that change.** Overlay worker (port, per-origin pools, `SQS_ENDPOINT`, token rule) and `calculateSpatialMetricsBatch`; `messageQueueConsumer` on the local queue by default; data-tables handler on local storage and `overlayDataTablePlugin`'s remote-to-URL helpers on the registry; fragment worker `server.ts` and `FRAGMENT_WORKER_DEV_HANDLER` in `sketches.ts`; URL-not-key clipping sources through `GeographyPlugin`, `sketches.ts`, the SQL `clipping_layers_for_*` functions, and `GeographySettings`; `getBoundsForClippingLayer` deciding by output type; sketch-preprocessing worker under `wrangler dev` and the client variable for its URL; the ACL-on option and token hand-off (if time allows; otherwise an open question with the design above).

**Exit.** The report-card and data-table journeys from the phase 3 list, plus a sketch-clipping journey that mixes a production EEZ with a local layer, run in CI on the e2e profile with no AWS or Cloudflare credentials. The data profile's exit criterion in [local services](local-services.md) is met. `service-inventory.md` has no row whose local stand-in is "none" for an in-scope service.

## Proposed decisions

To be moved into *Decisions* with the month when accepted; items that implementation overturns are corrected in place.

- Local object storage is Miniflare's R2, shared across `wrangler dev` sessions through one persistence directory under `.data/`, with local-specific bucket names. Workers read through their production bindings unmodified.
- Writers keep the S3 protocol and reach local R2 through a local-only S3 gateway Worker that implements the operations SeaSketch uses and nothing else. No S3-compatible container, no R2-shaped shim in production Workers.
- Stored references are self-describing: URL columns are complete URLs, remote columns are bucket-qualified, bucket names are unique across stores, and no code derives one from the other by assuming a host. A store registry maps bucket to endpoint, public origins, and optional credentials; production buckets are built in without credentials. Deletes against a store without credentials are refused. This narrows the "hostnames are later debt" stance in [second install](second-install.md) to the non-data hostnames.
- Clipping-layer sources cross process boundaries as URLs.
- The `DataUploads` S3 bucket moves to R2 (migration step 1), preferably within phase 1. The public uploads bucket and tile packages follow later by the same recipe.
- The spatial-uploads handler's default local form is the production container under RIE, built from a prebuilt runtime image on GHCR that production also uses. Host mode is an opt-in.
- Two `pmtiles-server` sessions cover the tiles and uploads hosts.
- The result queue is ElasticMQ. AWS credentials leave the default profile. Cloudflare Queues is a noted direction, not a decision.
- Workers follow the API's rule for the overlay-engine token: no secret ARN outside production means no header.
- `SUBDIVISION_WORKER_DEV_HANDLER` and `FRAGMENT_WORKER_DEV_HANDLER` join the dev-handler pattern; the fragment worker gets a local server; the overlay worker moves to 3007.
- The client gets exactly one new variable, `REACT_APP_SKETCH_PREPROCESSING_URL`.
- `npm run dev` starts the data path by default; `--profile core` opts out.
- The golden snapshot carries no objects; fixtures keep production public URLs; local objects are created through the pipeline.

## Open questions

- *(Phase 1)* Spike: several `wrangler dev` sessions on one persistence directory under concurrent writes (gateway) and reads (two `pmtiles-server` sessions), and gateway throughput for a multi-GB upload with `lib-storage` multipart. Pass criteria are the exact SDK calls the handlers make, the API's aws-sdk v2 presign as the browser sends it, and no SQLite lock errors across a ten-upload run.
- *(Phase 1)* Whether `preview_bucket_name` or a `[env.local]` block is the right way to give the Workers local-specific bucket names under `wrangler dev` without touching their production configuration.
- *(Phase 1)* Whether migration step 1 lands inside phase 1 or immediately after. Inside is cleaner for the registry; after is a smaller first pull request.
- *(Phase 1)* GHCR runtime image: whether a per-digest tag pinned in the Dockerfile (reproducible, needs a bump PR when the runtime changes) or a floating `latest` (zero maintenance, less reproducible) is the right default for both local and production builds.
- *(Phase 1)* Whether the gateway should verify SigV4 for the placeholder credentials. It is implementable (the secret is known) and would catch presign bugs locally; it is also more code in a local-only component.
- *(Phase 2)* Whether ACL-on local mode and the `OVERLAY_ENGINE_ACCESS_TOKEN` hand-off are built in this phase or deferred until the multi-level admin journeys need them.
- *(Phase 2)* Whether the overlay worker, fragment worker, and data-tables handler should also gain RIE container forms for CI parity with Lambda, or whether host `tsx` is sufficient. The default position is sufficient until a discrepancy is observed.
- *(Phase 2)* Whether the e2e profile's data services share the developer's containers (fewer resources) or get a second Compose project (full isolation). The design above assumes shared containers and separate `wrangler dev` sessions.

## Exit criteria

- **Phase 1:** A clean machine with Docker, Node, and a `.env` containing a Mapbox token runs `setup` then `dev`, uploads a layer, and renders it from local storage beside production-hosted fixture layers; the layer survives `dev` restarts and is removed by `setup --reset`. CI runs the upload journey without cloud credentials. Every data-path URL the API writes comes from the store registry, and switching the write target does not change how any existing row resolves.
- **Phase 2:** The same machine builds a geography from a local layer and a production EEZ, clips a sketch, creates its fragments, and renders a report with overlay metrics, with every SeaSketch process local. CI runs the data-table, report-card, and sketch-clipping journeys without cloud credentials. [Local services](local-services.md) phase 3 exit criterion is met and marked.
- **Throughout:** For each integration, the override variable that points at production is documented beside its local default, and the CI profile check rejects it. No pull request in these phases changes production behavior when the new variables are unset. No pull request adds a hostname literal to the data path.

## Effect on the other topic files

On acceptance: [local services](local-services.md) resolves its phase 3 open questions (emulator over per-developer AWS queue; local R2 under Miniflare over fixture archives; prebuilt runtime image for CI build time) and its phase 5 question (fragment and subdivision get local entry points here), and its *Profiles* text records that the data profile is the `npm run dev` default. [Second install](second-install.md) narrows its known-debt paragraph to the hostnames this plan does not touch, and gains the self-describing-reference rule, which is exactly what a second install's storage needs. [Service inventory](service-inventory.md) is updated row by row as each stand-in ships, since it describes the present. [Secrets](secrets-management.md) gains the manifest entries in the configuration table. The repo `README.md` and the package READMEs receive the operating instructions; this file does not.
