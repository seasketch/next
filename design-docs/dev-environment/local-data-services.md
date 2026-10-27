# Local data services

> Part of the [2026 campaign record](README.md). Status: proposed architecture, October 2026. Awaiting review. An implementation plan follows acceptance.

[Index](README.md) · [Strategy](strategy.md) · [Local services](local-services.md) · [Service inventory](service-inventory.md)

## Intent

A developer or agent runs `npm run setup` and `npm run dev` on a clean machine, with a `.env` that holds little more than a Mapbox token, and gets a SeaSketch where the whole data path is local: upload a spatial layer, see it on the map served from local storage, prepare it for analysis, run overlay metrics in a report against it, and clip sketches to a shoreline or to a geography built from locally uploaded layers. No production credentials, no AWS or Cloudflare account, and nothing a local run does can touch a production object, queue, or Lambda.

Pointing one integration at its deployed counterpart stays possible, per integration, for someone debugging production. It is an explicit override and never the default.

This document is the architecture for the *data profile* that [local services](local-services.md) and [strategy](strategy.md) phase 3 call for. It refines those documents rather than replacing them: where this file is more specific, it is the record for the data path.

## Scope

**In scope.** Object storage for uploads, tile archives, FlatGeobufs, parquet, and ACL documents; tile and download serving; the spatial-uploads handler; the subdivision worker; the data-tables handler; the overlay worker and the result queue the API consumes; the fragment worker; the sketch-preprocessing worker; the API, client, and infrastructure changes that let all of them run against local endpoints; startup, persistence, reset, and CI integration.

**Out of scope.** Third-party products the app renders through: Mapbox, Google and ArcGIS basemap tiles, Cloudflare Images, Unsplash, Auth0, taxonomy APIs. A developer still needs a Mapbox token. Also out of scope, though they would fit the same object store later: the public uploads bucket (`PUBLIC_S3_BUCKET` — sprites, consent documents, style uploads, forum attachments), offline tile packages (`TILE_PACKAGES_BUCKET`), the PII classifier Lambda, and the AI data analyst. They remain unavailable when unset, as the rules already require.

**Public reference data stays public.** Shoreline clipping keeps reading the OSM land FlatGeobuf and H3 land archives from `uploads.seasketch.org` and `tiles.seasketch.org`, and the golden snapshot's fixture layers (data library templates, `demo-samoa` geographies) keep their production URLs. Anonymous reads of immutable public objects are allowed in every profile ([local services](local-services.md), *Rules*). What has to work is *mixing*: a geography may clip by a production-hosted EEZ and a locally uploaded layer in the same operation.

## Starting point (October 2026)

[Service inventory](service-inventory.md) is the full table. The facts that shape this design:

- **Object storage has no local stand-in.** Raw uploads go to the `DataUploads` S3 bucket by presigned browser PUT; every output (tile archives, FlatGeobufs, GeoTIFFs, parquet, ACL documents, subdivided sources) is written to the `ssn-tiles` R2 bucket through the S3 API. Nothing in a local run can be written anywhere but production storage, so a local upload is impossible without production credentials.
- **Production hostnames are both constructed and recognized.** `uploads.seasketch.org`, `tiles.seasketch.org`, and `overlay.seasketch.org` are literals in the API (`GeographyPlugin`, `calculateSpatialMetricsBatch`, `JobStatusUpdater`, `sketches.ts`, `metadataParserPlugin`, `replacePMTilesPlugin`, `reportsPlugin`), in the overlay and fragment workers (an undici `Pool` bound to `https://uploads.seasketch.org`, object keys turned into URLs by prefixing it), in the subdivision worker (`R2_PUBLIC_BASE_URL`), and in `pmtiles-server` (host-based routing on `url.hostname === "uploads.seasketch.org"`). Clipping layers are passed between the API and workers as *object keys*, not URLs, so a key is only meaningful on one host. [Second install](second-install.md) lists this as debt left alone; the data path cannot run locally without paying the part of it that builds and recognizes data URLs.
- **The API's S3 presigning uses aws-sdk v2** with `{ region }` only (`dataUploadTaskPlugin`, `overlayDataTablePlugin`, `replacePMTilesPlugin`, and others). v2 ignores `AWS_ENDPOINT_URL*`; a local endpoint needs explicit `endpoint`, path-style addressing, and credentials. The handlers and the subdivision worker use SDK v3 and boto3, which honor `AWS_ENDPOINT_URL`, `AWS_ENDPOINT_URL_S3`, and `AWS_ENDPOINT_URL_SQS`, but SDK v3 still needs path-style set in code.
- **Result delivery for overlay and subdivision is SQS.** The API's `messageQueueConsumer` receives *and deletes* messages from `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL`; workers post to the queue URL in their payload with the SDK's default endpoint. Today's development setup uses a shared AWS queue, which needs AWS credentials and makes two developers' APIs steal each other's results.
- **Worker authentication reads AWS Secrets Manager.** Overlay, fragment, and subdivision workers fetch a JWT via `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` to read private hosted data and throw when the secret is unreachable. The API already skips this token when the ARN is unset outside production (September 2026); the workers do not.
- **Local entry points are uneven.** Spatial uploads has a host dev server (`tsx watch server.ts`, port 3005) and a production Docker image that takes tens of minutes to build (GDAL, PROJ, GEOS, HDF5, NetCDF from source). The overlay worker has a host dev server, on port 3006 — the same port as the data-tables handler. The subdivision container exists in Compose but the API only knows `SUBDIVISION_WORKER_LAMBDA_ARN`. The fragment worker is Lambda-only. `pmtiles-server` has a `wrangler dev` recipe nobody starts, bound to real R2. The sketch-preprocessing worker is a Cloudflare Worker whose URL is hardcoded in two client components.
- **Startup is in place.** `npm run dev` (`scripts/dev.mjs`, `scripts/dev.config.mjs`) runs Compose for containers and `concurrently` for host processes, with `--profile`, `--ci`, `--only`, readiness probes, `.logs/`, `npm run status`, and the `Dev: stack` VS Code task. `envFor` already injects `SCREENSHOTTER_URL` into the API when it starts the local screenshotter. The `data` Compose profile is declared and empty.
- **Reset is a database operation.** `npm run setup -- --reset` restores the golden snapshot. There is no object store to reset.

## Rules

These apply [local services](local-services.md) rules to the data path and add two.

**Resolve each integration from the environment, in this order.** (1) A *deployed-target* variable is set — a Lambda ARN, an `https://…amazonaws.com` queue URL, a Cloudflare R2 endpoint, a `*.workers.dev` URL. Use it with the ambient AWS or Cloudflare credentials; the start command does not start the local counterpart. This is the production override; the CI profile forbids these values. (2) An explicit *local-target* variable is set — a `*_DEV_HANDLER` URL, a local object-store endpoint. Use it; the start command assumes something else is serving it. (3) Neither is set. `npm run dev` starts the local service and injects its default URL into the processes that call it. An API started outside `npm run dev` with nothing set keeps today's behavior: the feature is unavailable.

**Local is the default.** `npm run dev` with an empty `.env` starts the data path. The lighter stack is the opt-out: `npm run dev -- --profile core`.

**Fidelity over convenience.** Where a local component can be the production artifact (the same container image, the same Worker code under `wrangler dev`, the same SDK calls against an S3 endpoint), it is. Substitutes are used only where the production artifact cannot run on a laptop, and the difference is listed in *Fidelity* below. Code paths that exist only for local runs are configuration, not branches: a different endpoint or base URL, not an `if (isLocal)`.

**No new hostname literals.** Every URL the data path constructs comes from a base-URL variable with the production value as its default, and every place that *recognizes* a hosted-data URL consults the same configured set. Object keys do not cross process boundaries without their origin.

## Architecture

### Topology

Everything below runs on one machine. Containers are Compose services in the root `compose.yaml`; host processes are entries in `scripts/dev.config.mjs`. Ports are defaults; each is a variable.

```
Browser ── client :3000 ─┬─ API :3857 (GraphQL, graphile-worker, SQS consumer)
                         │     │
                         │     ├─ presigned PUT ──────► object store :8333  (container, S3 API)
                         │     │                          buckets: spatial-uploads, ssn-tiles
                         │     ├─ invoke ─► spatial-uploads :9001 (container, Lambda RIE) ──► object store
                         │     ├─ invoke ─► subdivision     :9000 (container, Lambda RIE) ──► object store, queue
                         │     ├─ POST   ─► data-tables     :3006 (host)                  ──► object store
                         │     ├─ POST   ─► overlay worker  :3007 (host)                  ──► queue
                         │     ├─ POST   ─► fragment worker :3008 (host)
                         │     └─ receive ◄─ ElasticMQ :9324 (container, SQS API)
                         │
                         ├─ tiles, TileJSON, parquet ─► pmtiles-server :8787 (wrangler dev, tiles role) ──► object store
                         ├─ FlatGeobuf, archives ─────► pmtiles-server :8788 (wrangler dev, uploads role) ──► object store
                         ├─ clip, warm-cache ─────────► sketch-preprocessing-worker :8789 (wrangler dev) ──► object store
                         └─ public reference data ───► uploads.seasketch.org, tiles.seasketch.org (anonymous reads, unchanged)
```

The existing core services (Postgres 54321, Redis 6379, API, client, watchers, screenshotter 8791) are unchanged. The e2e profile gets its own instances of the host services on offset ports and its own buckets and queue names, following the pattern the screenshotter already uses (8791/8792); the containers are shared.

### Object storage

**One S3-compatible store, two buckets, named like production.** A single container serves the S3 API. It holds `spatial-uploads` (the role of the `DataUploads` S3 bucket: raw uploads, written by presigned PUT, read by the handlers) and `ssn-tiles` (the role of the R2 bucket: every output, under the same key layout production uses — `projects/<slug>/public/…`, `projects/<slug>/subdivided/…`, `acl/<ns>/projects/<slug>.json`, data-library prefixes). Keeping production's key layout is what lets `pmtiles-server`'s `classifyResource` and `isTilePresentationKey`, the cleanup tasks, and the ACL document paths run unmodified. The remotes the handlers already understand (`r2://ssn-tiles`, `s3://spatial-uploads/…`) resolve to the local store by endpoint, not by name.

**Requirements the store must meet**, in order of how hard they are to work around: presigned `PutObject` from a browser, with bucket CORS for `PUT`, `GET`, and `HEAD` from `http://localhost:3000`; `GetObject` with `Range` (PMTiles, FlatGeobuf, and parquet readers are all range readers); multipart upload (the handler switches to multipart above 500 MB); `HeadObject`; `DeleteObject` for the cleanup tasks (`cleanupDeletedOverlayRecords` and its siblings, which delete by key and never list); path-style addressing; anonymous reads, so the Worker-side shim below needs no signing; persistence on a Docker volume; a single container with no external dependencies; `amd64` and `arm64` images; a license the project is comfortable shipping in its development stack.

**Candidate: SeaweedFS**, started as `weed server -s3 -s3.allowedOrigins=*` with a data directory on a named volume. Apache-2.0, maintained since 2015, one binary, roughly 100 MB idle, path-style S3, bucket and global CORS, presigned URLs, range reads, multipart, `ListObjectsV2`, and anonymous access when no identities are configured. MinIO, the usual answer, is no longer one: its Community Edition went source-only in October 2025 and the repository was archived in April 2026 with the official images removed, and the last image carries an unpatched privilege-escalation CVE. **RustFS** (Apache-2.0, MinIO-shaped, 1.0 in September 2026) is the alternate if SeaweedFS's single-process mode proves awkward; **Garage** (AGPL) and LocalStack (no persistence in the community edition; an emulator, not a store) were considered and set aside. The choice is confirmed by a short spike in the implementation plan, against the requirements list above, before anything depends on it.

**Credentials.** The store runs with authentication off. The SDK clients still need *some* access key to sign with, so the local profile sets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` to fixed placeholder values that the manifest marks as public configuration, together with `AWS_REGION=us-west-2`. A production override for S3 or R2 supplies real credentials the normal way.

**Bucket setup is idempotent and runs at start.** A `scripts/object-store.mjs` step (called from `setup` and from `dev.mjs` after the container is healthy) creates the two buckets and applies the CORS configuration if missing. It is the local stand-in for the CDK stacks that create the production buckets, and lives beside them in spirit: the CORS rule is copied from `DataUploadsStack`.

### Hosted-data origins

This is the one cross-cutting change, and the API, the handlers, the workers, and `pmtiles-server` all depend on it. It is the part of the hostname debt the data path has to pay; the rest (API host in email templates, issuer defaults, metrics host filters) stays as [second install](second-install.md) left it.

**Three base-URL variables with production defaults.** `UPLOADS_BASE_URL` (default `https://uploads.seasketch.org`), `TILES_BASE_URL` (default `https://tiles.seasketch.org`), and `OVERLAY_BASE_URL` (default `https://overlay.seasketch.org`). The spatial-uploads handler already takes the first two; this extends them to the API, the subdivision worker (replacing `R2_PUBLIC_BASE_URL`), and anywhere else a URL is built. The local profile sets them to `http://localhost:8788`, `http://localhost:8787`, and `http://localhost:8787`.

**One recognizer, one list.** A small shared module (`packages/hosted-data-origins`, or a file each in API and workers if a package is overkill) answers `isHostedDataUrl(url)` and `classifyHostedDataUrl(url) → { role: "uploads" | "tiles" | "overlay", origin }` against the *union* of the configured origins and the production origins. The production origins are always recognized, so the golden snapshot's fixture layers and the public land datasets keep working on every machine. Every literal comparison in the API (`GeographyPlugin.getBoundsForClippingLayer`'s `/tiles.seasketch.org/` test, `JobStatusUpdater`'s fallback URL, `parseClippingLayer`, `metadataParserPlugin`, `replacePMTilesPlugin`, `reportsPlugin`) moves onto it. The client's `isHostedDataHost` already includes `localhost`; it is reviewed against the same list.

**URLs cross process boundaries, not keys.** `clipping_layers_for_geography` already returns both `object_key` and `url`. The API passes `url` to the fragment worker and the overlay worker, and `GeographySettings.clippingLayers[].source` becomes a URL on write (existing rows are read either way: a value without a scheme is treated as a key on `UPLOADS_BASE_URL`, which is how production has always interpreted it). The sketch-preprocessing worker accepts the same. This is what makes a production EEZ and a local upload composable in one geography.

**Workers fetch through an origin map.** The overlay worker, fragment worker, and `sketches.ts` keep their undici pools, but one pool per origin, created on demand from the URL's origin, rather than one pool for one hardcoded host. A process that cannot reach a public origin directly — a container that sees the host's `localhost:8788` as `host.docker.internal:8788` — gets a `HOSTED_DATA_ORIGIN_MAP` of `publicOrigin=reachableOrigin` pairs and rewrites the origin before fetching. In production the map is empty and the code path is identity. This single mechanism replaces the `url.replace("https://uploads.seasketch.org", "")` idiom and the separate internal/external URL variables that would otherwise multiply.

### AWS SDK clients

**One client factory per runtime.** The API gets `src/aws/s3Client.ts` (aws-sdk v2 `S3` and SDK v3 `S3Client` constructors), `sqsClient.ts`, and `lambdaClient.ts`, and every ad hoc `new S3({ region })`, `new SQSClient(...)`, and `new Lambda(...)` moves onto them. The factory reads: `S3_ENDPOINT` (or `AWS_ENDPOINT_URL_S3`) and sets `endpoint`, `s3ForcePathStyle` / `forcePathStyle`, and credentials when it is present; `SQS_ENDPOINT` (or `AWS_ENDPOINT_URL_SQS`) likewise. R2 clients keep `R2_ENDPOINT`, which already exists; locally it points at the same store as `S3_ENDPOINT`, because one store plays both buckets. The handlers' `remotes.ts` and the subdivision worker's `_create_r2_client` make the same change in SDK v3 and boto3, which is mostly setting path-style since those SDKs already read the endpoint variables.

**Presigned URLs are signed for the host the browser uses.** The API signs against `http://localhost:8333`; the browser PUTs to the same string. Containers that read the bucket use their own endpoint (`http://object-store:8333` on the Compose network) and sign their own requests, so the two never need to agree.

**Lambda invocation keeps the dev-handler pattern.** `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER`, `OVERLAY_WORKER_DEV_HANDLER`, and `DATA_TABLES_LAMBDA_DEV_HANDLER` exist. `SUBDIVISION_WORKER_DEV_HANDLER` and `FRAGMENT_WORKER_DEV_HANDLER` are added with the same semantics: POST the Lambda event as JSON, read the response. For the two container workers the dev-handler URL is the Lambda Runtime Interface Emulator's invoke URL (`http://localhost:900x/2015-03-31/functions/function/invocations`), so the API sends exactly the event the deployed Lambda receives.

### Tile and download serving

**`pmtiles-server` runs as two `wrangler dev` instances**, because its behavior is selected by hostname and local URLs differ by port, not host. The literal `url.hostname === "uploads.seasketch.org"` becomes `url.host === (env.UPLOADS_HOST ?? "uploads.seasketch.org")`. The instance on 8787 (tiles role, with the `overlay-data-tables` service binding) serves TileJSON, ZXY tiles, parquet queries, and previews; the instance on 8788 is started with `UPLOADS_HOST=localhost:8788` and serves raw objects with range support, as the uploads host does in production. Both listen on `0.0.0.0` so containers can reach them. `JWKS_URL` points at the local API (the `.dev.vars.example` default already does). `AUTH_ACL_ENABLED` defaults to `false`, matching the deployed `wrangler.toml`; turning it on locally is a flag, so access-control journeys can exercise ACL documents before production enables them.

**The R2 binding is replaced by a read-only shim when a local store is configured.** `pmtiles-server` and the sketch-preprocessing worker only call `bucket.get(key, { range, onlyIf })` and `bucket.head(key)`. A `localBucket.ts` implements those two methods over anonymous HTTP `GET`/`HEAD` to `${LOCAL_OBJECT_STORE_URL}/ssn-tiles/${key}`, translating R2's `range` and `onlyIf` into `Range` and `If-None-Match` and the response into the `R2Object` shape (`body`, `size`, `etag`, `httpEtag`, `writeHttpMetadata`). `index.ts` picks `env.LOCAL_OBJECT_STORE_URL ? localBucket(env) : env.TILES_BUCKET`. Miniflare's own local R2 was considered and rejected: the writers are S3 SDK clients, and Miniflare does not expose an S3 endpoint, so the store has to be the system of record and R2 is the thing emulated. The shim is small and is the only Worker code that exists for local runs.

**ACL documents** are written by the API's `writeProjectAclDoc` (aws-sdk v2 against `R2_ENDPOINT`) to `acl/local/projects/<slug>.json` in the local `ssn-tiles`. `TILES_ACL_NAMESPACE=local` and the `envProfile` guard against `prod` stay in force unchanged.

### Spatial uploads

**The production container is the default local handler.** The current host-mode `tsx watch server.ts` entry depends on a hand-installed GDAL, tippecanoe, and go-pmtiles whose versions drift from the image; re-evaluated against the fidelity goal, it is demoted to an opt-in. The default runs `packages/spatial-uploads-handler`'s own image under the Lambda RIE as a Compose service (`spatial-uploads`, host port 9001), the same way `subdivision` runs today, with `develop.watch` syncing `dist/` and restarting the container while a host `tsc -b --watch` rebuilds it. `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER` is injected as the RIE invoke URL. The README already documents this recipe; it becomes the thing the start command does.

**The slow part of the image is prebuilt and shared with production.** The Dockerfile splits into a runtime stage (GDAL 3.9.2, PROJ, GEOS, HDF5, NetCDF, tippecanoe, go-pmtiles, rclone, unrar, fiona, rasterio — everything that takes tens of minutes) published to GHCR by a workflow that runs when that stage changes, and an application stage `FROM ghcr.io/seasketch/spatial-uploads-runtime:<digest>` that copies `dist/` and takes seconds. The production Lambda image is built from the same two stages, so the local handler and the deployed one run the same binaries. This also answers the open question in [local services](local-services.md) about image build time in pull-request CI: CI pulls the runtime layer.

**Container-facing configuration.** The service receives `S3_ENDPOINT`/`R2_ENDPOINT` as `http://object-store:8333`, `RESOURCES_REMOTE=r2://ssn-tiles`, `TILES_REMOTE=r2://ssn-tiles/…` as production does, `UPLOADS_BASE_URL`/`TILES_BASE_URL` as the *browser-facing* local origins (these go into URLs stored in the database, so they must be what the browser will fetch), and a `HOSTED_DATA_ORIGIN_MAP` for anything it fetches itself. The Lambda database client (`lambda-db-client.ts`) reaches Postgres on the Compose network.

**Host mode stays available** as `npm run dev -- --only spatial-uploads-host` for someone iterating on the handler's TypeScript with the toolchain installed. It is not started by default and is not used in CI.

### Message queue

**ElasticMQ as a Compose service** (`softwaremill/elasticmq-native`, port 9324, SQS-compatible, in-memory, no credentials). The queue it hosts is defined in a committed `elasticmq.conf` as `overlay-engine-results`, with the e2e profile's queue beside it. The API's local `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL` default is `http://localhost:9324/000000000000/overlay-engine-results`.

A queue URL *names* the queue; the endpoint variable says where to send the request. The API's consumer, the overlay worker (host), and the subdivision worker (container) each get `SQS_ENDPOINT` for their own network position, and all of them can carry the same queue URL in payloads. The subdivision worker's region parsing (`sqs.<region>.amazonaws.com`) becomes a fallback to `AWS_REGION` when the URL is not an AWS one.

Message loss on container restart is acceptable: the queue carries job *progress* for jobs whose state of record is Postgres, and a job that misses its completion message is already handled as a timeout today. This settles the per-developer-AWS-queue versus emulator question in [local services](local-services.md) toward the emulator, because the alternative keeps AWS credentials in the default profile.

### Worker authentication

The overlay-engine access token exists so workers can read *private* hosted data and so `pmtiles-server` can trust them. Locally, `pmtiles-server` runs with ACL enforcement off by default, as production does today, and the token adds nothing. The workers adopt the API's existing rule: when `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` is unset outside production, send no `Authorization` header and log once; in production, throw `MisconfiguredError`. Secrets Manager is not emulated. For the ACL-on local mode, the API — which already mints these tokens (`mintOverlayEngineAccessToken`) — can hand a long-lived token to the local workers through an `OVERLAY_ENGINE_ACCESS_TOKEN` variable, which `dev.mjs` can mint at start by calling the API's signing code. That is an extension for whenever ACL-on journeys arrive, not part of the default profile.

### Overlay worker

Runs as it does now, host-side under `tsx watch`, moved to port 3007 so it no longer collides with the data-tables handler. Changes: the per-origin pool and origin map above; `SQS_ENDPOINT`; optional token. The `OVERLAY_WORKER_DEV_HANDLER` default is injected by `dev.mjs`. The worker's land and H3 inputs (`LAND_FLATGEOBUF_URL`, the `tiles.seasketch.org` archives) stay on their production public URLs. A developer who wants to test a modified shoreline sets those variables to a local upload.

### Subdivision worker

The Compose service already exists. The API gains `SUBDIVISION_WORKER_DEV_HANDLER` with the RIE URL as its local default; `preprocessSource` uses it under the same resolution rule as the other handlers. The worker swaps `R2_PUBLIC_BASE_URL` for `UPLOADS_BASE_URL`, reads `SQS_ENDPOINT`/`AWS_ENDPOINT_URL_SQS`, and applies `HOSTED_DATA_ORIGIN_MAP` when downloading its source.

### Data-tables handler

Already a host process on 3006 and already parameterized by `TILES_REMOTE` and `UPLOADS_BASE_URL`. It receives the local endpoint and base URLs; its parquet output lands in local `ssn-tiles` and is served by the tiles-role `pmtiles-server` through the `overlay-data-tables` binding, which is the production path. `TAXONOMY_PROXY_URL` is a third-party dependency and stays external.

### Fragment worker

Gets a `server.ts` like the overlay worker's: an HTTP server on 3008 that reads a JSON Lambda event and calls `lambdaHandler`, so the four invocations in `sketches.ts` go through `FRAGMENT_WORKER_DEV_HANDLER` with unchanged payloads. Its hosted-data fetches use the origin map; its token follows the worker-authentication rule. Deployment is unchanged.

### Sketch-preprocessing worker

Runs under `wrangler dev` on 8789 with the same `localBucket` shim as `pmtiles-server` (it, too, only reads). The client's two hardcoded calls (`SketchEditorModal.tsx`, `GeographyAdmin.tsx`) move to `REACT_APP_SKETCH_PREPROCESSING_URL`, defaulting to the deployed URL, so the production client is unchanged; the local client `.env.template` points at 8789. Clipping sources arrive as URLs per the hosted-data rule, and the worker's `DEV` branch that fetched through the public host is replaced by the same origin map the Node workers use.

### Client

Little changes. Layer, tile, and download URLs come from the database, so a local upload already renders from `localhost:8787`/`8788` once the API writes those URLs. `isHostedDataHost` is checked against the shared origin list; the preprocessing URL becomes a variable; `REACT_APP_TILES_ACL_NAMESPACE` stays `local`. The presigned upload flow in the browser is untouched.

### Configuration

The resolution rule in *Rules* is implemented in `dev.mjs`'s `envFor`, generalizing the `SCREENSHOTTER_URL` case: for each local service it starts, it injects the service's default URL into the processes that call it, unless the caller's `.env` already names a target. The table lists what an empty `.env` resolves to and what overrides it. New variables enter `packages/api/env-manifest.json` with the class shown; `envProfile`'s `seasketch.org` and CI checks forbid deployed values in CI.

| Integration | Local default (injected by `dev.mjs`) | Production override (set in `.env`, never in CI) | Manifest class |
| --- | --- | --- | --- |
| Object store (S3 role) | `S3_ENDPOINT=http://localhost:8333`, `SPATIAL_UPLOADS_BUCKET=spatial-uploads`, placeholder `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` | unset `S3_ENDPOINT` with real AWS credentials and the production bucket name | public-config / production-secret |
| Object store (R2 role) | `R2_ENDPOINT=http://localhost:8333`, `R2_TILES_BUCKET=ssn-tiles`, placeholder R2 keys | `R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com` and real keys | public-config / production-secret |
| Hosted-data origins | `UPLOADS_BASE_URL=http://localhost:8788`, `TILES_BASE_URL=http://localhost:8787`, `OVERLAY_BASE_URL=http://localhost:8787` | production defaults (unset) | public-config |
| Tiles and uploads serving | two `wrangler dev` instances, `LOCAL_OBJECT_STORE_URL`, `UPLOADS_HOST`, `AUTH_ACL_ENABLED=false` | not applicable — the client follows URLs in the database | public-config |
| Spatial uploads | `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER=http://localhost:9001/2015-03-31/functions/function/invocations` | `SPATIAL_UPLOADS_LAMBDA_ARN` | public-config / production-secret |
| Subdivision | `SUBDIVISION_WORKER_DEV_HANDLER=http://localhost:9000/2015-03-31/functions/function/invocations` | `SUBDIVISION_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Data tables | `DATA_TABLES_LAMBDA_DEV_HANDLER=http://localhost:3006` (exists) | `DATA_TABLES_HANDLER_LAMBDA_ARN` | public-config / production-secret |
| Overlay worker | `OVERLAY_WORKER_DEV_HANDLER=http://localhost:3007` | `OVERLAY_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Result queue | `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL=http://localhost:9324/000000000000/overlay-engine-results`, `SQS_ENDPOINT=http://localhost:9324` | an `https://sqs.<region>.amazonaws.com/…` URL (the per-developer queues `SQSStack` provisions) | public-config / per-environment-name |
| Fragment worker | `FRAGMENT_WORKER_DEV_HANDLER=http://localhost:3008` | `FRAGMENT_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Sketch preprocessing | `REACT_APP_SKETCH_PREPROCESSING_URL=http://localhost:8789` | the `*.workers.dev` URL | public-config |
| Worker token | `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` unset — no header | the ARN, with AWS credentials | production-secret |
| Container-facing endpoints | set in `compose.yaml` (`http://object-store:8333`, `http://elasticmq:9324`, `HOSTED_DATA_ORIGIN_MAP=http://localhost:8788=http://host.docker.internal:8788,…`) | not applicable | public-config |

A mixed configuration is legitimate: `SPATIAL_UPLOADS_LAMBDA_ARN` set and everything else local sends uploads through the deployed handler, which then writes to production storage and records production URLs — which is what debugging that handler needs, and which the resolution rule makes explicit rather than accidental. The manifest's CI profile check rejects every value in the override column.

### Startup

- **`compose.yaml`** gains `object-store`, `elasticmq`, and `spatial-uploads` in a `data` profile (the existing `workers` profile folds into it), each with a healthcheck, and a named volume for the store. `dev.mjs` already starts Compose with `--profile data` when the data profile is selected.
- **`scripts/dev.config.mjs`** gains `pmtiles-tiles`, `pmtiles-uploads`, `sketch-preprocessing`, `fragment-worker`, `spatial-uploads-tsc` (the host `tsc -b --watch` that feeds the container), and the moved `overlay-worker`, with `ready` probes and `dependsOn` edges (`api` waits for the store and queue; the Workers wait for the API for JWKS). `spatial-uploads` (host mode) stays as an opt-in entry.
- **Default profile.** `npm run dev` runs core plus data. `--profile core` is the opt-out. `--ci` starts the data services once, without watchers, as it does for the current handlers. The e2e profile adds the data services on offset ports with `-e2e` suffixed buckets and queue, so a Playwright run can execute an upload journey beside a developer's own stack.
- **`npm run setup`** also brings up the store and creates buckets, so the first `dev` is not the first time storage exists. `npm run status` lists the new ports; `npm run logs -- <service>` works for every entry; `.logs/` is unchanged.
- **VS Code.** `Dev: stack` already runs `npm run dev` and inherits the new default. A `Dev: core only` task is added for the opt-out. Tasks remain a convenience, not the contract ([environment setup](env-setup.md)).
- **Host requirements.** Docker and Node, as today. No GDAL, tippecanoe, Java, or Python on the host.

### Persistence and reset

Uploaded data survives restarts and is destroyed with the database.

- The store's data directory is a **named Compose volume** (`seasketch_object-store`), not a bind mount into the repository. A bind mount would leave root-owned files on Linux that `rm -rf` cannot remove without `sudo`, and would need a gitignore entry; a named volume is removed with one `docker volume rm`. Postgres already persists the same way (its container's own volume). ElasticMQ is in-memory by design.
- **`npm run setup -- --reset`** removes the volume and recreates the buckets in the same step that drops the database and restores the golden snapshot, so object storage and database rows are reset together and never disagree. Without `--reset`, `setup` leaves both alone.
- **CI** starts from an empty volume on every run; the e2e profile also empties its `-e2e` buckets at suite start, so a developer running `npm run e2e` locally gets the same clean slate.
- **The golden snapshot does not include objects.** Its fixture layers point at production public URLs, and that stays true: shipping a bucket image beside the database dump would double the snapshot's size and maintenance for layers that are public anyway. A later fixture that needs a *local* object (for example, a private layer for an access-control journey) is uploaded by the journey itself through the normal pipeline, per the rule in `AGENTS.md`.

### Fidelity

What differs from production in the default local profile, and why each is acceptable:

| Difference | Why it is acceptable |
| --- | --- |
| HTTP, not HTTPS; path-style S3 URLs, not virtual-hosted | Transport only. Signing, CORS, and range semantics are exercised the same way. |
| SeaweedFS (or RustFS) instead of S3 and R2 | The handlers talk to both through the S3 API already; R2's own API is used only by `get`/`head` in two Workers, which the shim covers. |
| Lambda RIE instead of Lambda | Same image, same event, same handler entry point. RIE does not enforce the 15-minute timeout or memory limit; Compose `mem_limit` can approximate the latter when a job is suspected of exceeding it. The API awaits the dev-handler call rather than firing an async `Event` invoke — existing behavior of the dev-handler path. |
| ElasticMQ instead of SQS | Same SDK calls. Messages are lost on restart; job state of record is Postgres. |
| No Cloudflare edge cache in front of `pmtiles-server` | Cache behavior is not under test locally. |
| Workers send no access token | Matches an ACL-off `pmtiles-server`, which is production's current setting. ACL-on local mode supplies a token. |
| Overlay worker, fragment worker, data-tables handler run as host Node processes under `tsx` rather than Lambda containers | Pure-Node code with no native toolchain; already the dev pattern for two of the three. Containerizing them is possible later with the RIE recipe if a Node-version or dependency discrepancy ever bites. |
| Sketch-preprocessing and `pmtiles-server` under `wrangler dev` (workerd) | Same runtime as production; that is the point of `wrangler dev`. |

## Phases

Both phases sit inside [strategy](strategy.md) phase 3 ("data profile") and the first items of phase 5 (sketch processing). Each phase is a set of pull requests that keep `master` deployable; the base-URL variables default to production values, so production behavior does not change until a profile sets them.

### Phase 1 — Spatial uploads for map visualization

**Goal.** On a clean machine with only a Mapbox token: `setup`, `dev`, sign in, upload a shapefile, GeoJSON, GeoTIFF, or FlatGeobuf, and see it on the map, with tiles and downloads served from local storage. Delete it and the objects are cleaned up. Restart and it is still there. `setup --reset` and it is gone.

**Components that change.** The object store; `compose.yaml` and `dev.config.mjs`; `setup` and `--reset`; the AWS client factories in the API and `remotes.ts`; the hosted-data origin module and the API's URL construction and recognition sites that uploads touch (`spatialUploads`, `JobStatusUpdater`, `replacePMTilesPlugin`, `metadataParserPlugin`, `writeProjectAclDoc`, the cleanup tasks); the Dockerfile split and GHCR runtime image; the spatial-uploads Compose service with watch; `pmtiles-server`'s host variable, `localBucket` shim, and two-instance start; the client's host list review; the manifest and templates; `README.md` instructions. The subdivision worker is also pointed at the local store in this phase, because uploads larger than the preprocessing threshold enqueue it, and because its Compose service already exists; its progress messages need the queue, so **ElasticMQ lands at the end of phase 1** with only the subdivision producer and the API consumer on it.

**Exit.** A fresh clone reaches a rendered local upload with the empty-`.env` path. The upload journey from the phase 3 bundler-risk list runs in the e2e profile in CI. `npm run status` shows every data service. A developer who sets `SPATIAL_UPLOADS_LAMBDA_ARN` and real credentials gets the deployed handler and nothing else changes. No production hostname literal remains in the API's upload path.

### Phase 2 — Reporting and sketch processing

**Goal.** Create a geography from locally uploaded clipping layers (and from production EEZ data), draw a sketch, see it clipped and its fragments created locally, and run a report whose overlay metrics are computed by the local overlay worker against local data tables and local layers.

**Components that change.** Overlay worker (port, origin map, `SQS_ENDPOINT`, token rule) and `calculateSpatialMetricsBatch`; `messageQueueConsumer` on the local queue by default; data-tables handler on the local store and the tiles-role `pmtiles-server` serving its parquet; fragment worker `server.ts` and `FRAGMENT_WORKER_DEV_HANDLER` in `sketches.ts`; URL-not-key clipping sources through `GeographyPlugin`, `sketches.ts`, and `GeographySettings`; sketch-preprocessing worker under `wrangler dev` with the shim, and the client variable for its URL; the geography bounds lookup on the origin recognizer; the ACL-on option and token hand-off (if time allows; otherwise an open question with the design above).

**Exit.** The report-card and data-table journeys from the phase 3 list, plus a sketch-clipping journey, run in CI on the e2e profile with no AWS or Cloudflare credentials. The data profile's exit criterion in [local services](local-services.md) is met. `service-inventory.md` has no row whose local stand-in is "none" for an in-scope service.

## Proposed decisions

To be moved into *Decisions* with the month when accepted; items that implementation overturns are corrected in place.

- The data path's object storage is one S3-compatible container with two buckets named as production's, persisted on a named Compose volume that `setup --reset` removes. SeaweedFS is the candidate, confirmed by a spike; RustFS is the alternate; MinIO is not an option in 2026.
- URL construction and recognition for hosted data go through base-URL variables with production defaults and one shared recognizer that always includes the production origins. Clipping layers and other hosted-data references cross process boundaries as URLs. This narrows the "hostnames are later debt" stance in [second install](second-install.md) to the non-data hostnames.
- The spatial-uploads handler's default local form is the production container under the Lambda RIE, built from a prebuilt runtime image on GHCR that production also uses. Host mode is an opt-in.
- `pmtiles-server` and the sketch-preprocessing worker run under `wrangler dev` against the local store through a read-only R2-shaped shim; two `pmtiles-server` instances cover the tiles and uploads hosts.
- The result queue is ElasticMQ. AWS credentials leave the default profile.
- Workers follow the API's rule for the overlay-engine token: no secret ARN outside production means no header.
- `SUBDIVISION_WORKER_DEV_HANDLER` and `FRAGMENT_WORKER_DEV_HANDLER` join the dev-handler pattern; the fragment worker gets a local server; the overlay worker moves to 3007.
- The client gets exactly one new variable, `REACT_APP_SKETCH_PREPROCESSING_URL`.
- `npm run dev` starts the data path by default; `--profile core` opts out.
- The golden snapshot carries no objects; fixtures keep production public URLs; local objects are created through the pipeline.

## Open questions

- *(Phase 1)* Which store passes the spike. SeaweedFS's anonymous mode and presigned-PUT handling are documented but should be exercised with the exact aws-sdk v2 presign the API produces, and its multipart path with the handler's 500 MB threshold, before the Compose file names it.
- *(Phase 1)* Whether the API should run the object-store bucket setup itself at boot (idempotent `CreateBucket` + `PutBucketCors`) in addition to `setup`, so an API started outside `npm run dev` against a fresh store still works, or whether that is scope creep for a process that should not administer storage.
- *(Phase 1)* Whether `host.docker.internal` is reliable enough on Linux Docker Engine (it needs `extra_hosts: host-gateway`) for the container-side origin map, or whether the containers should instead reach `pmtiles-server` by a Compose-network alias with `wrangler dev` itself moved into a container. The former is less change; the latter has fewer moving parts per OS.
- *(Phase 1)* GHCR runtime image: whether a per-digest tag pinned in the Dockerfile (reproducible, needs a bump PR when the runtime changes) or a floating `latest` (zero maintenance, less reproducible) is the right default for both local and production builds.
- *(Phase 2)* Whether ACL-on local mode and the `OVERLAY_ENGINE_ACCESS_TOKEN` hand-off are built in this phase or deferred until the multi-level admin journeys need them.
- *(Phase 2)* Whether the overlay worker, fragment worker, and data-tables handler should also gain RIE container forms for CI parity with Lambda, or whether host `tsx` is sufficient. The default position is sufficient until a discrepancy is observed.
- *(Phase 2)* Whether the e2e profile's data services share the developer's containers (fewer resources, bucket/queue suffixes) or get a second Compose project (full isolation, double the containers). The design above assumes shared containers.

## Exit criteria

- **Phase 1:** A clean machine with Docker, Node, and a `.env` containing a Mapbox token runs `setup` then `dev`, uploads a layer, and renders it from local storage; the layer survives `dev` restarts and is removed by `setup --reset`. CI runs the upload journey without cloud credentials. Every data-path URL the API writes comes from a variable.
- **Phase 2:** The same machine builds a geography from a local layer and a production EEZ, clips a sketch, creates its fragments, and renders a report with overlay metrics, with every SeaSketch process local. CI runs the data-table, report-card, and sketch-clipping journeys without cloud credentials. [Local services](local-services.md) phase 3 exit criterion is met and marked.
- **Throughout:** For each integration, the override variable that points at production is documented beside its local default, and the CI profile check rejects it. No pull request in these phases changes production behavior when the new variables are unset.

## Effect on the other topic files

On acceptance: [local services](local-services.md) resolves its phase 3 open questions (emulator over per-developer AWS queue; local store through a shim over Miniflare or fixture archives; prebuilt runtime image for CI build time) and its phase 5 question (fragment and subdivision get local entry points here), and its *Profiles* text records that the data profile is the `npm run dev` default. [Second install](second-install.md) narrows its known-debt paragraph to the hostnames this plan does not touch. [Service inventory](service-inventory.md) is updated row by row as each stand-in ships, since it describes the present. [Secrets](secrets-management.md) gains the manifest entries in the configuration table. The repo `README.md` and the package READMEs receive the operating instructions; this file does not.
