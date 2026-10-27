# Local data services

> Part of the [2026 campaign record](README.md). Status: proposed architecture, October 2026. Awaiting review. An implementation plan follows acceptance.

[Index](README.md) · [Strategy](strategy.md) · [Local services](local-services.md) · [Service inventory](service-inventory.md) · [Second install](second-install.md)

## Intent

A developer or agent runs `npm run setup` and `npm run dev` on a clean machine, with a `.env` that holds little more than a Mapbox token, and gets a SeaSketch where the whole data path is local: upload a spatial layer, see it on the map served from local storage, prepare it for analysis, run overlay metrics in a report against it, and clip sketches to a shoreline or to a geography built from locally uploaded layers. No production credentials, no AWS or Cloudflare account, and nothing a local run does can touch a production object, queue, or Lambda.

Getting there requires SeaSketch to treat *where an object is stored* as data rather than as deployment configuration. That same property is what a second production installation needs. So this plan first upgrades production's storage model so that any number of installations, buckets, and backends coexist in one schema and one code path, deploys and verifies that, and only then builds the local profile on top of it.

Pointing one integration at its deployed counterpart stays possible, per integration, for someone debugging production. It is an explicit override and never the default.

This document is the architecture for the *data profile* that [local services](local-services.md) and [strategy](strategy.md) phase 3 call for, and for the storage groundwork that precedes it. Where it is more specific than those files, it is the record for the data path.

## Glossary

- **R2** — Cloudflare's object store. From inside a Worker it is reached through a *binding* (`env.BUCKET.get(key)`); from anywhere else it is reached through its S3-compatible HTTP API with an account-specific endpoint. That is the supported way for a Lambda or a laptop to read or write R2.
- **Miniflare** — the local simulator that `wrangler dev` runs Workers in. It provides local R2, KV, D1, and queue bindings backed by files under a persistence directory. It does **not** expose an S3 endpoint; local R2 is reachable only through bindings.
- **RIE** — the AWS Lambda Runtime Interface Emulator, a small server AWS ships inside its Lambda base images. Running a Lambda container image locally with RIE gives an HTTP endpoint (`POST /2015-03-31/functions/function/invocations`) that delivers the posted JSON to the handler exactly as Lambda would. `packages/subdivision-worker` already runs this way in `compose.yaml`.
- **GHCR** — the GitHub Container Registry (`ghcr.io`), an image registry attached to the GitHub organization that GitHub Actions can push to with its default token. Proposed as the place to publish the prebuilt GDAL runtime image so neither laptops nor CI compile it.
- **ElasticMQ** — an SQS-compatible message queue server that runs as one container with no credentials.
- **Storage location** — the unit of the storage model below: one bucket on one backend, with the origins it is served from. A row in `storage_locations`.

## Scope

**In scope.** The storage model (schema, API, handlers, workers, infra) and its production rollout; migrating raw uploads from S3 to R2; local object storage, tile and download serving; the spatial-uploads handler; the subdivision worker; the data-tables handler; the overlay worker and the result queue the API consumes; the fragment worker; the sketch-preprocessing worker; startup, persistence, reset, and CI integration.

**Deliberately on Lambda and SQS.** Spatial uploads, subdivision, overlay analysis, and fragment creation stay on Lambda, invoked by the API, with progress and results returned over SQS. Those workloads need a container image, several gigabytes of memory, and sub-second scale-from-zero; Workers cannot host them and Cloudflare Containers do not scale from zero well enough. Cloudflare is used for what it is good at here — storage, tile serving, edge-side preprocessing — and the local profile emulates Lambda with RIE and SQS with ElasticMQ, not with Workers.

**Out of scope.** Third-party products the app renders through: Mapbox, Google and ArcGIS basemap tiles, Cloudflare Images, Unsplash, Auth0, taxonomy APIs. A developer still needs a Mapbox token. The PII classifier Lambda and the AI data analyst remain unavailable when unset. The public uploads bucket (`PUBLIC_S3_BUCKET`: sprites, consent documents, style uploads, forum attachments) and offline tile packages (`TILE_PACKAGES_BUCKET`) are not wired locally by this plan; they are natural later tenants of the same storage model and are listed as such.

**Public reference data stays public.** Shoreline clipping keeps reading the OSM land FlatGeobuf and H3 land archives from `uploads.seasketch.org` and `tiles.seasketch.org`, and the golden snapshot's fixture layers (data library templates, `demo-samoa` geographies) keep their production URLs. Anonymous reads of immutable public objects are allowed in every profile ([local services](local-services.md), *Rules*). What has to work is *mixing*: a geography may clip by a production-hosted EEZ and a locally uploaded layer in the same operation, and a project may hold layers from both.

## Starting point (October 2026)

[Service inventory](service-inventory.md) is the full table. The facts that shape this design:

- **Storage is deployment configuration, not data.** Raw uploads go to the `DataUploads` S3 bucket by presigned browser PUT; every output (tile archives, FlatGeobufs, GeoTIFFs, parquet, ACL documents, subdivided sources) is written to the `ssn-tiles` R2 bucket through the S3 API. Which bucket, and which hostnames it is served from, are environment variables on the API and Lambdas (`SPATIAL_UPLOADS_BUCKET`, `R2_TILES_BUCKET`, `TILES_REMOTE`, `RESOURCES_REMOTE`, `UPLOADS_BASE_URL`, `TILES_BASE_URL`, `R2_PUBLIC_BASE_URL`) and literals in code (`uploads.seasketch.org`, `tiles.seasketch.org`, `overlay.seasketch.org` in `GeographyPlugin`, `calculateSpatialMetricsBatch`, `JobStatusUpdater`, `sketches.ts`, `metadataParserPlugin`, `replacePMTilesPlugin`, `reportsPlugin`, `overlayDataTablePlugin`, both Node workers, the subdivision worker, and `pmtiles-server`'s host routing). A process can therefore only ever address one bucket per role, and the bucket has to be production's.
- **Stored references are partly qualified.** `data_sources.url` and `data_upload_outputs.url` are complete URLs. `data_upload_outputs.remote` and `overlay_data_tables.parquet_remote` / `column_stats_remote` / `source_parquet_remote` / `coverage_remote` are `r2://bucket/key` strings that code parses (`data_layers_vector_object_key` strips the bucket off to hand a bare key to the fragment and overlay workers, which prefix a constant host back on; `overlayDataTablePlugin` builds five kinds of URL by prefixing a constant host onto the key). Legacy GeoJSON uploads have a precedent for a registry: `data_sources_buckets` (url, name, region, location) and `data_sources.bucket_id`, chosen by region. `deleted_geojson_objects` stores bucket and key.
- **Every writer speaks the S3 protocol.** The API presigns with aws-sdk v2 (`dataUploadTaskPlugin`, `overlayDataTablePlugin`, `replacePMTilesPlugin`), writes ACL documents and deletes objects with aws-sdk v2 against `R2_ENDPOINT`; the spatial-uploads and data-tables handlers write with SDK v3 (`remotes.ts`, multipart above 500 MB via `@aws-sdk/lib-storage`); the subdivision worker writes with boto3. Only two Workers read through R2 bindings, `pmtiles-server` and the sketch-preprocessing worker, and both call only `get` and `head`.
- **Upload progress is a browser concern.** `ProjectBackgroundJobManager` PUTs the file to the presigned URL with axios and writes `onUploadProgress` into the Apollo cache. Nothing server-side observes the upload until the handler is invoked.
- **Result delivery for overlay and subdivision is SQS.** The API's `messageQueueConsumer` receives *and deletes* messages from `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL`; workers post to the queue URL in their payload. Today's development setup uses a shared AWS queue, which needs AWS credentials and lets two developers' APIs take each other's results.
- **Worker authentication reads AWS Secrets Manager.** Overlay, fragment, and subdivision workers fetch a JWT via `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` and throw when it is unreachable. The API already skips this token when the ARN is unset outside production (September 2026); the workers do not.
- **Local entry points are uneven.** Spatial uploads has a host dev server (port 3005) and a production Docker image that takes tens of minutes to build. The overlay worker's host server is on 3006, the data-tables handler's port. The subdivision container exists in Compose but the API only knows `SUBDIVISION_WORKER_LAMBDA_ARN`. The fragment worker is Lambda-only. `pmtiles-server` has a `wrangler dev` recipe nobody starts, bound to real R2. The sketch-preprocessing worker's URL is hardcoded in two client components.
- **Startup is in place.** `npm run dev` (`scripts/dev.mjs`, `scripts/dev.config.mjs`) runs Compose for containers and `concurrently` for host processes, with `--profile`, `--ci`, `--only`, readiness probes, `.logs/`, `npm run status`, and the `Dev: stack` VS Code task. `envFor` already injects `SCREENSHOTTER_URL` into the API when it starts the local screenshotter.
- **Reset is a database operation.** `npm run setup -- --reset` restores the golden snapshot. There is no object store to reset.

## Rules

These apply [local services](local-services.md) rules to the data path and add three.

**Storage is addressed through locations, never through process configuration.** Every stored object is identified by a `storage_locations` row and a key. Code that needs an endpoint, a bucket name, a public origin, or credentials asks the location. The only storage facts a process holds in its environment are *which locations it writes new objects to* and *which credential sets it has*. No code constructs a URL from a key by assuming a host, and no code parses a URL or remote string to recover a key.

**Resolve each compute integration from the environment, in this order.** (1) A *deployed-target* variable is set — a Lambda ARN, an `https://…amazonaws.com` queue URL, a `*.workers.dev` URL. Use it with the ambient credentials; the start command does not start the local counterpart. This is the production override; the CI profile forbids these values. (2) An explicit *local-target* variable is set — a `*_DEV_HANDLER` URL. Use it; the start command assumes something else is serving it. (3) Neither is set. `npm run dev` starts the local service and injects its default URL into the processes that call it. An API started outside `npm run dev` with nothing set keeps today's behavior: the feature is unavailable.

**Local is the default.** `npm run dev` with an empty `.env` starts the data path. The lighter stack is the opt-out: `npm run dev -- --profile core`.

**Fidelity over convenience.** Where a local component can be the production artifact (the same container image, the same Worker code under `wrangler dev` with the same bindings, the same SDK calls to a different endpoint), it is. Substitutes are used only where the production artifact cannot run on a laptop, and each is listed in *Fidelity* below. Code paths that exist only for local runs are configuration, not branches.

**Production first.** Changes to the storage model and to where production stores uploads are deployed and verified on production before the local profile depends on them. A pull request in the groundwork phase changes one thing, deploys through the normal workflow, and is checked by the production probe and a manual upload before the next begins.

## Architecture

### Storage model

This is the center of the plan. Everything else is configuration of it.

**`storage_locations`.** One table, owned by the API's migrations:

| Column | Meaning |
| --- | --- |
| `id text primary key` | Stable slug: `ssn-tiles`, `ssn-uploads`, `ssn-tiles-local`, `ssn-uploads-local` |
| `backend text` | `r2` or `s3` |
| `bucket text` | Bucket name on that backend |
| `endpoint text` | S3-API endpoint. An R2 account endpoint, a local gateway URL, or null for the AWS regional default |
| `region text` | Signing region. `auto` for R2 |
| `credential_set text` | Name of the environment credential set that can write here: `R2`, `AWS`, `LOCAL` |
| `public_origin text` | Origin raw objects are served from (`https://uploads.seasketch.org`), or null if the location is never served |
| `tiles_origin text` | Origin presentation routes are served from (`https://tiles.seasketch.org`), or null |
| `created_at` | |

Origins are **immutable once referenced**: renaming a hostname is a new location and a copy, never an update. That is what lets stored URLs stay stored (below) without a sync mechanism.

**Credentials stay in the environment, keyed by set.** `credential_set` names a prefix: `R2` resolves `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` (today's names); `AWS` means the SDK's default chain (the Lambda role, or a laptop's profile); `LOCAL` resolves to fixed placeholder values the local gateway accepts. A process that lacks a location's credential set can read it by public URL and nothing else. On a laptop with no `R2_*` variables, every production location is therefore read-only, and a cleanup task that reaches a production object logs and skips rather than deleting it — a safety property today's code does not have.

**Write targets are two environment variables.** `STORAGE_DATA_LOCATION` (default `ssn-tiles` in production, `ssn-tiles-local` in the templates) names where outputs, ACL documents, parquet, and subdivided sources go. `STORAGE_UPLOAD_STAGING_LOCATION` (`ssn-uploads` / `ssn-uploads-local`) names where presigned browser uploads land before processing. They replace `SPATIAL_UPLOADS_BUCKET`, `R2_TILES_BUCKET`, `TILES_REMOTE`, `RESOURCES_REMOTE`, `UPLOADS_BASE_URL`, `TILES_BASE_URL`, `R2_PUBLIC_BASE_URL`, `BUCKET`, and `R2_BUCKET` across the API and Lambdas. Switching a machine from production storage to local, or an installation from one bucket to another, is a change to these two variables; every existing row keeps resolving to wherever it was written.

**Object references in the schema.** Tables that own objects carry `storage_location_id text not null references storage_locations` and key columns, replacing remote strings:

- `data_upload_outputs`: `storage_location_id`, `key`. `remote` is dropped after the backfill. `url` stays as a stored column (see below).
- `overlay_data_tables`: `storage_location_id`, `parquet_key`, `column_stats_key`, `source_parquet_key`, `coverage_key`, replacing the four `*_remote` columns.
- `data_sources.bucket_id` → `storage_location_id`; `data_sources_buckets` rows become `s3` locations and the table is dropped; `deleted_geojson_objects.bucket` becomes `storage_location_id`.
- `project_background_jobs` and overlay result messages that today carry `bucket` and `key` carry `storage_location_id` and `key`.

**URLs are stored, not derived.** `data_sources.url` and `data_upload_outputs.url` remain stored, complete URLs, written once from the location's origin at creation. The alternative — deriving them at read time from location and key — was set aside because `data_sources.url` also holds external service URLs (ArcGIS, third-party tile servers) and because the client reads these columns on every map load. Immutable origins make the two representations consistent without a trigger. A single function, `storageUrl(location, key, role)`, is the only place a URL is assembled, and a test asserts stored URLs round-trip through it. Derived URLs that are not stored — the data-table query, orgQuery, temporal-preview, and sibling URLs in `overlayDataTablePlugin` — are produced by the same function from `(storage_location_id, parquet_key)`.

**Hosted-data references between processes carry URLs.** `clipping_layers_for_geography` and its siblings return the FlatGeobuf output's stored `url`; `sketches.ts`, `calculateSpatialMetricsBatch`, `GeographyPlugin`, and the sketch-preprocessing worker pass and accept URLs. `GeographySettings.clippingLayers[].source` becomes a URL; the workers treat a value without a scheme as a legacy key on `https://uploads.seasketch.org` for one release, then drop that. The overlay worker, fragment worker, and `sketches.ts`'s `sourceCache` open one undici `Pool` per origin on demand. `GeographyPlugin.getBoundsForClippingLayer` decides how to read a layer by the output's `type`, not by inspecting the URL's host.

**Handlers and workers receive the location in the payload.** The API's invocation of the spatial-uploads handler, the data-tables handler, and the subdivision worker includes the write-target location rows (minus nothing — credentials are never in rows) alongside the job. The handler builds its S3 client from `endpoint`, `region`, `bucket`, and the credential set it has in its own environment, writes, and reports `(storage_location_id, key, url)` per output. The API validates that reported locations are the ones it sent. A Lambda therefore holds no storage configuration at all and can serve more than one installation. The ACL document writer, `replacePMTilesPlugin`, `metadataParserPlugin`, and the cleanup tasks use the same client factory in-process.

**One S3 client factory per runtime.** `storageClient(location, credentials)` in the API (aws-sdk v2 and SDK v3 variants, since both are in use), in `remotes.ts` for the Node handlers, and in the subdivision worker for boto3. It sets endpoint, region, path-style when an endpoint is present, and credentials from the set. The eleven ad hoc `new S3({ region })` / `new S3({ endpoint: R2_ENDPOINT })` constructions in the API collapse onto it.

**What this gives a second installation.** Its own database holds its own `storage_locations` rows (its R2 account, its bucket names, its hostnames); its `pmtiles-server` and sketch-preprocessing Workers are deployed bound to its buckets; its API and Lambdas carry its credential sets. The Lambdas can be the same deployments as the first installation's, because every invocation names its locations. Nothing in the schema or code distinguishes installation A from B, which is the property [second install](second-install.md) asks this campaign to preserve.

**Backfill.** The migration inserts `ssn-tiles` (R2, production endpoint, `R2` credentials, both production origins) and `ssn-uploads` (R2, after step 0a) — and `data-uploads` (S3, `AWS`) if any rows still reference it — then parses each `remote` once, in SQL, into `(storage_location_id, key)`, and refuses to complete if any remote names an unknown bucket. `data_sources_buckets` rows become S3 locations with their existing names. This is the only time a remote string is parsed.

### Topology (local profile)

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
                         │                                                        buckets: ssn-tiles-local, ssn-uploads-local
                         │                                                                                     ▲
                         ├─ tiles, TileJSON, parquet ─► pmtiles-server :8787 (wrangler dev, tiles role) ── R2 binding ─┤
                         ├─ FlatGeobuf, archives ─────► pmtiles-server :8788 (wrangler dev, uploads role) ── R2 binding ┤
                         ├─ clip, warm-cache ─────────► sketch-preprocessing-worker :8789 (wrangler dev) ── R2 binding ─┘
                         └─ public reference data ───► uploads.seasketch.org, tiles.seasketch.org (anonymous reads, unchanged)
```

The existing core services (Postgres 54321, Redis 6379, API, client, watchers, screenshotter 8791) are unchanged. The e2e profile gets its own `wrangler dev` sessions on offset ports with their own persistence directory, following the pattern the screenshotter already uses (8791/8792); the Compose containers are shared.

### Local object storage: R2 under Miniflare

**Local R2 is the system of record.** Every `wrangler dev` session in the data profile (`pmtiles-server` twice, the sketch-preprocessing worker, the S3 gateway) is started with the same `--persist-to <repo>/.data/wrangler/` directory, which is how Cloudflare documents sharing bindings between sessions. All of them see the same two buckets. The Workers that read R2 in production read local R2 through the same bindings, unmodified.

**Local locations are rows like any other.** `npm run setup` upserts `ssn-tiles-local` (`r2`, endpoint `http://localhost:8333`, bucket `ssn-tiles-local`, credential set `LOCAL`, origins `http://localhost:8788` and `http://localhost:8787`) and `ssn-uploads-local`. The golden snapshot's fixture rows reference `ssn-tiles`; a local database mixing `ssn-tiles` and `ssn-tiles-local` rows is the normal case. Key layout under the bucket is production's, so `pmtiles-server`'s `classifyResource` and `isTilePresentationKey`, the cleanup tasks, and the ACL document paths run unmodified. The Workers' local bucket names are set through `preview_bucket_name` or an `[env.local]` block, whichever `wrangler dev` honors in local mode.

**Writers reach local R2 through a local S3 gateway Worker.** Miniflare exposes R2 only to Workers. Every writer uses the S3 protocol, and in production that is also how it reaches R2. The local counterpart is a small Worker, `packages/local-s3-gateway`, run under `wrangler dev` on 8333 with one binding per local bucket, that accepts path-style S3 requests and performs them on the binding: `PutObject`, `GetObject` with `Range`, `HeadObject`, `DeleteObject`, `DeleteObjects`, `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`, and CORS preflight. It checks a presigned URL's `X-Amz-Expires` and that `Content-Type` matches what was signed; it does not verify SigV4. Everything else is `501`. Writers are configured by the location row only, so no writer code knows the gateway exists. It is permanent local infrastructure, bounded by the list above, with a contract test that runs each writer's real SDK calls against it.

**Where Miniflare behind a gateway is off from S3 or R2:**

| Gap | Effect | Position |
| --- | --- | --- |
| No signature verification | A broken presign succeeds locally and fails in production | Accepted for the default profile; expiry and content-type checks cover the common mistake. Verifying SigV4 for the `LOCAL` set is an open question. |
| No lifecycle rules | The 7-day expiry on staging uploads is not emulated | A cost control, not behavior under test. |
| ETag format for multipart, `x-amz-*` response headers | Synthesized from `R2Object` fields | No caller inspects them beyond `lib-storage`'s part bookkeeping; covered by the contract test. |
| Throughput: a multi-GB upload streams through workerd twice | Possibly slower than a native store | Unmeasured; spike item. Miniflare's blob store writes to disk. |
| Several workerd processes on one SQLite-backed persistence directory | Cloudflare recommends it; lock contention under concurrent writes is possible | Spike item. The fallback is one multi-config `wrangler dev` session hosting every Worker, which exposes only the primary over HTTP and would need a local-only path router. |
| `ListObjectsV2` | Not implemented | No current writer lists. |

**Persistence directory.** `.data/` at the repo root, gitignored, owned by the developer's user (no container writes it). It holds `wrangler/` for the shared Miniflare state and `wrangler-e2e/` for the e2e profile. Buckets are created implicitly on first binding use; the gateway answers CORS preflight with the rule `DataUploadsStack` declares today.

### Tile and download serving

**`pmtiles-server` runs as two `wrangler dev` sessions**, because its behavior is selected by hostname and local URLs differ by port, not host. The literal `url.hostname === "uploads.seasketch.org"` becomes `url.host === (env.UPLOADS_HOST ?? "uploads.seasketch.org")`. The session on 8787 (tiles role, with the `overlay-data-tables` service binding) serves TileJSON, ZXY tiles, parquet queries, and previews; the session on 8788 is started with `UPLOADS_HOST=localhost:8788` and serves raw objects with range support. Both read local R2 through the normal `TILES_BUCKET` binding. Both listen on `0.0.0.0` so containers can reach them. `JWKS_URL` points at the local API. `AUTH_ACL_ENABLED` defaults to `false`, matching the deployed `wrangler.toml`; turning it on locally is a flag.

A `pmtiles-server` deployment is bound to one bucket by design; an installation deploys one per data location. Its `UPLOADS_HOST` and the location's `public_origin` are the same fact stated in two places, and the implementation plan adds a check that they agree.

**ACL documents** are written by the API's `writeProjectAclDoc` to `acl/local/projects/<slug>.json` in the data location. `TILES_ACL_NAMESPACE=local` and the `envProfile` guard against `prod` stay in force.

### Spatial uploads handler

**The production container is the default local handler.** The host-mode `tsx watch server.ts` entry depends on a hand-installed GDAL, tippecanoe, and go-pmtiles whose versions drift from the image; it is demoted to an opt-in. The default runs the package's own image under RIE as a Compose service (`spatial-uploads`, host port 9001), the same way `subdivision` runs today, with `develop.watch` syncing `dist/` and restarting the container while a host `tsc -b --watch` rebuilds it. `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER` is injected as the RIE invoke URL, so the API sends exactly the event Lambda would receive.

**The slow part of the image is prebuilt and shared with production.** The Dockerfile splits into a runtime stage (GDAL 3.9.2, PROJ, GEOS, HDF5, NetCDF, tippecanoe, go-pmtiles, rclone, unrar, fiona, rasterio) published to GHCR by a workflow that runs when that stage changes, and an application stage `FROM ghcr.io/seasketch/spatial-uploads-runtime:<digest>` that copies `dist/` and takes seconds. The production Lambda image is built from the same two stages. This answers the open question in [local services](local-services.md) about image build time in pull-request CI.

**Container-facing configuration.** With locations in the payload, the container's environment is only credentials (`LOCAL_ACCESS_KEY_ID` / `LOCAL_SECRET_ACCESS_KEY`), the database URL, and a `STORAGE_ORIGIN_MAP` of `publicOrigin=reachableOrigin` pairs (`http://localhost:8333=http://host.docker.internal:8333`, likewise 8787 and 8788) that the client factory and fetches apply before connecting, because a container sees the host's `localhost` as `host.docker.internal`. `compose.yaml` sets `extra_hosts: host-gateway` so that name resolves on Linux Docker Engine. In production the map is empty and the code path is identity. The subdivision container uses the same map.

**Host mode stays available** as `npm run dev -- --only spatial-uploads-host` for someone iterating on the handler's TypeScript with the toolchain installed. It is not started by default and is not used in CI.

### Message queue

Subdivision and overlay analysis stay on Lambda and report through SQS, so the local profile emulates SQS. **ElasticMQ as a Compose service** (`softwaremill/elasticmq-native`, port 9324, no credentials). The queue is defined in a committed `elasticmq.conf` as `overlay-engine-results`, with the e2e profile's queue beside it. The API's local `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL` default is `http://localhost:9324/000000000000/overlay-engine-results`.

A queue URL *names* the queue; `SQS_ENDPOINT` (or `AWS_ENDPOINT_URL_SQS`) says where to send the request. The API's consumer, the overlay worker (host), and the subdivision worker (container) each get the endpoint for their own network position, and all carry the same queue URL in payloads. The subdivision worker's region parsing (`sqs.<region>.amazonaws.com`) becomes a fallback to `AWS_REGION` when the URL is not an AWS one. Message loss on container restart is acceptable: the queue carries job *progress* for jobs whose state of record is Postgres, and a missed completion is already handled as a timeout. This settles the per-developer-AWS-queue question in [local services](local-services.md) toward the emulator.

### Worker authentication

The overlay-engine access token exists so workers can read *private* hosted data and so `pmtiles-server` can trust them. Locally, `pmtiles-server` runs with ACL enforcement off by default, as production does today, and the token adds nothing. The workers adopt the API's existing rule: when `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` is unset outside production, send no `Authorization` header and log once; in production, throw `MisconfiguredError`. Secrets Manager is not emulated. For an ACL-on local mode, the API — which already mints these tokens — can hand a long-lived token to the local workers through an `OVERLAY_ENGINE_ACCESS_TOKEN` variable that `dev.mjs` mints at start. That is an extension for whenever ACL-on journeys arrive.

### Other workers

- **Overlay worker.** Host-side under `tsx watch`, moved to port 3007 so it no longer collides with the data-tables handler. Per-origin pools; `SQS_ENDPOINT`; token rule; clipping sources as URLs. `OVERLAY_WORKER_DEV_HANDLER` is injected by `dev.mjs`. Its land and H3 inputs stay on their production public URLs; a developer testing a modified shoreline sets those variables to a local upload's URL.
- **Subdivision worker.** The Compose service exists. The API gains `SUBDIVISION_WORKER_DEV_HANDLER` with the RIE URL as its local default; `preprocessSource` passes the data location in the payload; the worker reports `(storage_location_id, key, url)`.
- **Data-tables handler.** Host process on 3006, receives the data location in the payload; its parquet lands in `ssn-tiles-local` and is served by the tiles-role `pmtiles-server` through the `overlay-data-tables` binding, the production path. `TAXONOMY_PROXY_URL` is third-party and stays external.
- **Fragment worker.** Gets a `server.ts` like the overlay worker's: an HTTP server on 3008 that reads a JSON Lambda event and calls `lambdaHandler`, so the four invocations in `sketches.ts` go through `FRAGMENT_WORKER_DEV_HANDLER` with unchanged payloads. Clipping sources as URLs; per-origin pools; token rule.
- **Sketch-preprocessing worker.** Under `wrangler dev` on 8789 against the shared persistence directory, reading through its `SSN_TILES` binding. The client's two hardcoded calls move to `REACT_APP_SKETCH_PREPROCESSING_URL`, defaulting to the deployed URL; the local client `.env.template` points at 8789. For a source URL whose origin is its own bucket's `public_origin` it reads through the binding; for any other origin it fetches. The `DEV` branch goes away.
- **Client.** Layer, tile, and download URLs come from the database, so a local upload renders from `localhost:8787`/`8788` and a production layer in the same project keeps rendering from `tiles.seasketch.org`. `isHostedDataHost` in `tilesAuth.ts` already includes `localhost`. The presigned upload flow is untouched.

### Configuration

The resolution rule is implemented in `dev.mjs`'s `envFor`, generalizing the `SCREENSHOTTER_URL` case: for each local service it starts, it injects the service's default URL into the processes that call it unless the caller's `.env` already names a target. With the storage model, the table is short. New variables enter `packages/api/env-manifest.json` with the class shown; `envProfile`'s `seasketch.org` and CI checks forbid deployed values in CI.

| Integration | Local default | Production override (never in CI) | Manifest class |
| --- | --- | --- | --- |
| Write targets | `STORAGE_DATA_LOCATION=ssn-tiles-local`, `STORAGE_UPLOAD_STAGING_LOCATION=ssn-uploads-local` (templates) | `ssn-tiles`, `ssn-uploads` | public-config |
| Credential sets | `LOCAL_ACCESS_KEY_ID` / `LOCAL_SECRET_ACCESS_KEY` fixed placeholders (templates) | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; AWS default chain | public-config / production-secret |
| Local storage sessions | gateway on 8333, `pmtiles-server` on 8787 and 8788 with `UPLOADS_HOST`, preprocessing on 8789, all `--persist-to .data/wrangler` | not applicable — production Workers are deployments | public-config |
| Spatial uploads | `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER=http://localhost:9001/2015-03-31/functions/function/invocations` | `SPATIAL_UPLOADS_LAMBDA_ARN` | public-config / production-secret |
| Subdivision | `SUBDIVISION_WORKER_DEV_HANDLER=http://localhost:9000/2015-03-31/functions/function/invocations` | `SUBDIVISION_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Data tables | `DATA_TABLES_LAMBDA_DEV_HANDLER=http://localhost:3006` (exists) | `DATA_TABLES_HANDLER_LAMBDA_ARN` | public-config / production-secret |
| Overlay worker | `OVERLAY_WORKER_DEV_HANDLER=http://localhost:3007` | `OVERLAY_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Result queue | `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL=http://localhost:9324/000000000000/overlay-engine-results`, `SQS_ENDPOINT=http://localhost:9324` | an `https://sqs.<region>.amazonaws.com/…` URL (the per-developer queues `SQSStack` provisions) | public-config / per-environment-name |
| Fragment worker | `FRAGMENT_WORKER_DEV_HANDLER=http://localhost:3008` | `FRAGMENT_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Sketch preprocessing | `REACT_APP_SKETCH_PREPROCESSING_URL=http://localhost:8789` | the `*.workers.dev` URL | public-config |
| Worker token | `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` unset — no header | the ARN, with AWS credentials | production-secret |
| Container-facing | in `compose.yaml`: `STORAGE_ORIGIN_MAP`, `SQS_ENDPOINT=http://elasticmq:9324`, `extra_hosts: host-gateway` | not applicable | public-config |

A mixed configuration is legitimate and now well-defined: `SPATIAL_UPLOADS_LAMBDA_ARN` set with `STORAGE_DATA_LOCATION=ssn-tiles-local` would fail at the deployed Lambda, which has no `LOCAL` credential set — a clear error rather than a write to the wrong place. `SPATIAL_UPLOADS_LAMBDA_ARN` with `ssn-tiles` and `R2_*` set sends uploads through the deployed handler into production storage; those rows render and clip locally like any other production-hosted record.

### Startup

- **`compose.yaml`** gains `elasticmq` and `spatial-uploads` in a `data` profile (the existing `workers` profile folds into it), each with a healthcheck and `extra_hosts`. No storage container.
- **`scripts/dev.config.mjs`** gains `s3-gateway`, `pmtiles-tiles`, `pmtiles-uploads`, `sketch-preprocessing`, `fragment-worker`, `spatial-uploads-tsc`, and the moved `overlay-worker`, with `ready` probes and `dependsOn` edges (`api` waits for the gateway and queue; the Workers wait for the API for JWKS). Host-mode `spatial-uploads` stays as an opt-in entry.
- **Default profile.** `npm run dev` runs core plus data. `--profile core` is the opt-out. `--ci` starts the data services once, without watchers. The e2e profile adds the data services on offset ports with `--persist-to .data/wrangler-e2e` and its own queue.
- **`npm run setup`** upserts the local location rows. `npm run status` lists the new ports; `npm run logs -- <service>` works for every entry.
- **VS Code.** `Dev: stack` already runs `npm run dev` and inherits the new default. A `Dev: core only` task is added for the opt-out.
- **Host requirements.** Docker and Node, as today. No GDAL, tippecanoe, Java, or Python on the host.

### Persistence and reset

- Local R2 lives in `.data/wrangler/`, gitignored, written by `wrangler dev` as the developer's user. It persists across restarts and reboots.
- **`npm run setup -- --reset`** deletes `.data/wrangler/` in the same step that drops the database and restores the golden snapshot, so object storage and database rows reset together. Without `--reset`, `setup` leaves both alone.
- **CI** starts from a fresh checkout with no `.data/`; the e2e profile deletes `.data/wrangler-e2e/` at suite start.
- **The golden snapshot carries no objects.** Its fixture layers reference `ssn-tiles` and production URLs. A fixture that needs a local object is uploaded by the journey through the pipeline, per `AGENTS.md`.

### Fidelity

| Difference from production in the default local profile | Why it is acceptable |
| --- | --- |
| Miniflare's R2 instead of R2 | The Workers that read R2 run the same code against the same binding API. |
| Writers reach R2 through the local S3 gateway instead of R2's S3 endpoint | Same SDK calls, same protocol subset, same client factory; only the location row differs. Signatures are not verified (gap table). |
| HTTP, `localhost` ports instead of hostnames | Transport only. The hostname-selected behavior in `pmtiles-server` is exercised through `UPLOADS_HOST`. |
| RIE instead of Lambda | Same image, same event, same handler entry point. RIE does not enforce the 15-minute timeout or memory limit; Compose `mem_limit` can approximate the latter. The API awaits the dev-handler call rather than firing an async `Event` invoke — existing dev-handler behavior. |
| ElasticMQ instead of SQS | Same SDK calls. Messages are lost on restart; job state of record is Postgres. |
| No Cloudflare edge cache in front of `pmtiles-server` | Cache behavior is not under test locally. |
| Workers send no access token | Matches an ACL-off `pmtiles-server`, production's current setting. |
| Overlay worker, fragment worker, data-tables handler as host Node processes under `tsx` | Pure-Node code with no native toolchain; already the dev pattern for two of the three. Containerizing them with the RIE recipe is possible if a discrepancy ever bites. |

## Phase 0 — Production groundwork

Two changes, each its own pull request and deploy, each verified on production before the next. Both are improvements on their own; neither mentions local development.

### 0a. Raw uploads move from S3 to R2

**Should they?** Yes. The staging bucket is the only AWS S3 bucket on the data path. Moving it removes a backend kind, a credential set on every Lambda, and cross-cloud reads (the handler currently pulls from S3 to produce outputs it pushes to R2). Upload progress is not a reason to involve a Worker: progress is axios `onUploadProgress` on the browser's PUT, which is the same against R2's presigned PUT. A Worker upload endpoint was considered and set aside: it would run into Workers' request-body limits and need chunked routes for large files, for no gain in progress reporting.

**Change.** A new R2 bucket, `ssn-uploads`, with the CORS rule from `DataUploadsStack` and a 7-day object lifecycle rule. The three presigning sites use the R2 client. The spatial-uploads and data-tables handlers read the staged object through their existing R2 client. `DataUploadsNormalized`, referenced only by infra environment, is confirmed unused and removed. The S3 bucket is left in place, empty, until the lifecycle has drained it, then deleted by a later infra change.

**Verify on production.** Upload a shapefile, a GeoJSON, a GeoTIFF, a FlatGeobuf, and a data table; upload a file above 1 GB and watch progress; cancel an upload mid-flight; replace a PMTiles archive; confirm handler logs show R2 reads; confirm the lifecycle rule exists. The production probe is extended with a read-only check that `presignedUploadUrl` returns an R2 host. Rollback is the previous bucket name and client in the environment.

### 0b. The storage model

**Change.** The `storage_locations` table, the production rows, the backfill, the column changes listed in *Storage model*, the client factory, the location-in-payload contract for the three handlers and the subdivision worker, URL-based clipping sources, the removal of every data-path hostname literal and per-role bucket variable, and the SQL function changes. The GraphQL schema is unchanged for the client except that `remote`-typed fields, if any are exposed, become `storageLocationId` and `key`.

**Verify on production.** The full upload, data-table, geography, sketch, and report flows; a layer deletion with cleanup confirmed in R2; the production probe green; a dry-run query that every `data_upload_outputs` row's stored `url` equals `storageUrl(location, key)`. Rollback is a reverse migration that restores the `remote` columns from `(storage_location_id, key)`, which is lossless because the parse was.

**Exit for phase 0.** Both deployed and verified. No process on the data path carries a bucket name or a data hostname in its environment except the two write-target variables and credential sets. The Lambdas' environments contain no storage configuration.

## Phase 1 — Spatial uploads for map visualization, locally

**Goal.** On a clean machine with only a Mapbox token: `setup`, `dev`, sign in, upload a shapefile, GeoJSON, GeoTIFF, or FlatGeobuf, and see it on the map beside the project's production-hosted fixture layers, with tiles and downloads served from local storage. Delete it and the objects are cleaned up. Restart and it is still there. `setup --reset` and it is gone.

**Components that change.** The local S3 gateway Worker and its contract test; `.data/` persistence and `setup --reset`; local location rows in `setup`; `compose.yaml` and `dev.config.mjs`; the Dockerfile split and GHCR runtime image; the spatial-uploads Compose service with watch; `STORAGE_ORIGIN_MAP` in the client factory; `pmtiles-server`'s `UPLOADS_HOST` and two-session start with local bucket names; the manifest and templates; `README.md` instructions. The subdivision worker is pointed at local storage in this phase because larger uploads enqueue it and its Compose service exists; its progress messages need the queue, so **ElasticMQ lands at the end of phase 1** with only the subdivision producer and the API consumer on it.

**Exit.** A fresh clone reaches a rendered local upload with the empty-`.env` path, in a project that also shows the fixture production layers. The upload journey from the phase 3 bundler-risk list runs in the e2e profile in CI. `npm run status` shows every data service. A developer who sets `SPATIAL_UPLOADS_LAMBDA_ARN`, production write targets, and `R2_*` credentials gets the deployed handler and nothing else changes.

## Phase 2 — Reporting and sketch processing, locally

**Goal.** Create a geography from locally uploaded clipping layers (and from production EEZ data), draw a sketch, see it clipped and its fragments created locally, and run a report whose overlay metrics are computed by the local overlay worker against local data tables and local layers.

**Components that change.** Overlay worker (port, per-origin pools, `SQS_ENDPOINT`, token rule) and `calculateSpatialMetricsBatch`; `messageQueueConsumer` on the local queue by default; data-tables handler locally; fragment worker `server.ts` and `FRAGMENT_WORKER_DEV_HANDLER`; sketch-preprocessing worker under `wrangler dev` and the client variable for its URL; the ACL-on option and token hand-off if time allows.

**Exit.** The report-card and data-table journeys from the phase 3 list, plus a sketch-clipping journey that mixes a production EEZ with a local layer, run in CI on the e2e profile with no AWS or Cloudflare credentials. The data profile's exit criterion in [local services](local-services.md) is met. `service-inventory.md` has no row whose local stand-in is "none" for an in-scope service.

## Later tenants of the storage model

Not part of these phases; recorded so the model is built to take them. The public uploads bucket (`PUBLIC_S3_BUCKET` behind CloudFront at `PUBLIC_UPLOADS_DOMAIN`: sprites, consent documents, style uploads, forum attachments) becomes a location with `public_origin = https://<PUBLIC_UPLOADS_DOMAIN>`, and could move to R2 with a custom domain by the 0a recipe; stored URLs keep the domain, so no row changes. Offline tile packages (`TILE_PACKAGES_BUCKET`) likewise. The golden snapshot's own R2 prefix is already in `ssn-tiles`.

## Proposed decisions

To be moved into *Decisions* with the month when accepted; items that implementation overturns are corrected in place.

- Storage is modeled as `storage_locations` rows referenced by `(storage_location_id, key)` from every table that owns objects. Credentials stay in the environment, named by set. Two environment variables name the write targets. URLs are stored, written once from immutable origins by a single function. Remote strings and data-path hostname literals are removed. This replaces the "hostnames are later debt" stance in [second install](second-install.md) for the data path, and is the mechanism a second installation uses.
- Handlers and workers receive their storage locations in the invocation payload and hold no storage configuration in their environment.
- Raw uploads move from the `DataUploads` S3 bucket to an R2 bucket via presigned PUT through R2's S3 API, deployed and verified on production before anything else in this plan. No Worker in the upload path.
- Spatial uploads, subdivision, overlay analysis, and fragment creation stay on Lambda with SQS. Cloudflare is used for storage and serving.
- Local object storage is Miniflare's R2, shared across `wrangler dev` sessions through one persistence directory under `.data/`, with local-specific locations. Writers reach it through a local-only S3 gateway Worker. No S3-compatible container, no R2-shaped shim in production Workers.
- The spatial-uploads handler's default local form is the production container under RIE, built from a prebuilt runtime image on GHCR that production also uses. Host mode is an opt-in.
- Two `pmtiles-server` sessions cover the tiles and uploads hosts.
- The result queue is ElasticMQ locally; AWS credentials leave the default profile.
- Workers follow the API's rule for the overlay-engine token: no secret ARN outside production means no header.
- `SUBDIVISION_WORKER_DEV_HANDLER` and `FRAGMENT_WORKER_DEV_HANDLER` join the dev-handler pattern; the fragment worker gets a local server; the overlay worker moves to 3007.
- The client gets exactly one new variable, `REACT_APP_SKETCH_PREPROCESSING_URL`.
- `npm run dev` starts the data path by default; `--profile core` opts out.
- The golden snapshot carries no objects; fixtures keep production locations; local objects are created through the pipeline.

## Open questions

- *(Phase 0b)* Whether `data_sources.url` should become derived for SeaSketch-hosted source types in a later step, leaving it stored only for external services. The plan keeps it stored throughout; this would be a follow-on if immutable origins prove too restrictive.
- *(Phase 0b)* Whether `project_background_jobs` and in-flight overlay messages need a compatibility window during the deploy, since a Lambda invoked before the deploy may report a `remote` after it. The implementation plan should sequence the Lambda and API deploys or accept both shapes for one release.
- *(Phase 0a)* The R2 bucket name. `ssn-uploads` is used above; it should not be confused with `uploads.seasketch.org`, which serves `ssn-tiles`.
- *(Phase 1)* Spike: several `wrangler dev` sessions on one persistence directory under concurrent gateway writes and `pmtiles-server` reads, and gateway throughput for a multi-GB `lib-storage` multipart upload. Pass criteria are the exact SDK calls the handlers make, the API's aws-sdk v2 presign as the browser sends it, and no SQLite lock errors across a ten-upload run.
- *(Phase 1)* Whether `preview_bucket_name` or an `[env.local]` block is the right way to give the Workers local bucket names under `wrangler dev` without touching their production configuration.
- *(Phase 1)* GHCR runtime image: a per-digest tag pinned in the Dockerfile, or a floating `latest`.
- *(Phase 1)* Whether the gateway should verify SigV4 for the `LOCAL` credential set.
- *(Phase 2)* Whether ACL-on local mode and the `OVERLAY_ENGINE_ACCESS_TOKEN` hand-off are built in this phase or deferred until the multi-level admin journeys need them.
- *(Phase 2)* Whether the overlay worker, fragment worker, and data-tables handler should also gain RIE container forms for CI parity with Lambda. The default position is that host `tsx` is sufficient until a discrepancy is observed.

## Exit criteria

- **Phase 0:** Raw uploads land in R2 on production. The storage model is deployed; no data-path process holds a bucket name or data hostname outside the two write-target variables; every stored URL equals `storageUrl(location, key)`; the production probe is green after each deploy.
- **Phase 1:** A clean machine with Docker, Node, and a `.env` containing a Mapbox token runs `setup` then `dev`, uploads a layer, and renders it from local storage beside production-hosted fixture layers; the layer survives `dev` restarts and is removed by `setup --reset`. CI runs the upload journey without cloud credentials.
- **Phase 2:** The same machine builds a geography from a local layer and a production EEZ, clips a sketch, creates its fragments, and renders a report with overlay metrics, with every SeaSketch process local. CI runs the data-table, report-card, and sketch-clipping journeys without cloud credentials. [Local services](local-services.md) phase 3 exit criterion is met and marked.
- **Throughout:** For each compute integration, the override variable that points at production is documented beside its local default, and the CI profile check rejects it. No pull request adds a hostname literal or a per-role bucket variable to the data path.

## Effect on the other topic files

On acceptance: [local services](local-services.md) resolves its phase 3 open questions (emulator over per-developer AWS queue; local R2 under Miniflare over fixture archives; prebuilt runtime image for CI build time) and its phase 5 question (fragment and subdivision get local entry points here), and its *Profiles* text records that the data profile is the `npm run dev` default. [Second install](second-install.md) replaces its known-debt paragraph's data-path items with a pointer to the storage model, which is now the mechanism a second install uses for storage. [Strategy](strategy.md) phase 3 gains the phase 0 production groundwork as a prerequisite. [Service inventory](service-inventory.md) is updated row by row as each stand-in ships. [Secrets](secrets-management.md) gains the write-target and credential-set entries. The repo `README.md` and the package READMEs receive the operating instructions; this file does not.
