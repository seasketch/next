# Local data services

> Part of the [2026 campaign record](README.md). Status: proposed architecture, October 2026. Awaiting review. An implementation plan follows acceptance.

[Index](README.md) · [Strategy](strategy.md) · [Local services](local-services.md) · [Service inventory](service-inventory.md) · [Second install](second-install.md)

## Intent

Today, a developer cannot upload a layer, see it on the map, or run a report without production credentials, because the services behind those features only exist in production: object storage on R2 and S3, tile serving on a Cloudflare Worker, and processing on AWS Lambda with results delivered over SQS.

This plan makes all of that run on one machine. After it lands, a developer or an agent runs `npm run setup` and `npm run dev` on a clean computer with a `.env` that contains little more than a Mapbox token, and gets a SeaSketch where the whole data path is local. They can upload a spatial layer and see it on the map, served from local storage. They can prepare that layer for analysis and compute overlay metrics against it in a report. They can clip sketches to a shoreline, or to a geography built from locally uploaded layers. Nothing a local run does can touch a production object, queue, or Lambda.

The plan has three parts, in order:

1. **Production groundwork.** Two changes to production that are worth making on their own: moving raw uploads from S3 to R2, and making the code honest about where objects are stored so that rows pointing at production storage and rows pointing at local storage can live in the same database. Each is deployed and verified before the next step.
2. **Spatial uploads locally.** Local object storage, local tile serving, and the upload processor running as a container, so that uploading and viewing a layer works with no cloud account.
3. **Reporting and sketch processing locally.** The remaining processors (overlay analysis, data tables, subdivision, fragment creation, sketch preprocessing) and the queue that carries their results.

The first half of this document is the architecture and the plan. The second half is the detail behind each part, referenced from the first half.

## Goals and constraints

- **Local by default, with two controls.** There are two separate controls and they do different jobs. The *profile* (`npm run dev -- --profile <name>`) decides which processes `npm run dev` starts: the default profile starts the whole data path, and `--profile core` starts only Postgres, Redis, the API, the client, and the watchers. *Environment variables* decide which target the API uses for each integration. The two interact through one rule: for each data service, if its production variable (for example `SPATIAL_UPLOADS_LAMBDA_ARN`) is set in `.env`, the API uses production and `npm run dev` does not start the local service; otherwise `npm run dev` starts the local service and tells the API where it is. So an empty `.env` with the default profile is fully local; a `.env` with one ARN in it is local except for that one service; and `--profile core` makes the data features unavailable unless `.env` points them at production. Every production variable is rejected by the CI configuration check.
- **Fidelity.** Where a local component can be the production artifact, it is: the same container image, the same Worker code, the same SDK calls. Substitutes are used only where production cannot run on a laptop, and each one is listed with its differences.
- **Persistence.** Locally uploaded data survives restarts of `npm run dev` and of the machine. It is deleted by `npm run setup -- --reset`, which also restores the golden database snapshot, and it does not exist on a fresh CI checkout.
- **Mixed data.** The golden snapshot's fixture layers live on production storage, and a developer may have rows written during an earlier production-pointed session. Those rows must keep working after the machine switches to local storage, and a single project or geography may combine production-hosted and locally hosted layers.
- **Heavy compute stays on Lambda.** Spatial uploads, subdivision, overlay analysis, and fragment creation need container images, several gigabytes of memory, and sub-second scale-up from zero. Workers cannot host them and Cloudflare Containers do not scale from zero well. They stay on Lambda and report through SQS; locally they are emulated faithfully rather than rewritten.
- **Prefer Cloudflare for storage and serving.** Where a service still uses an S3 bucket, the plan moves it to R2.
- **Out of scope.** Third-party products the app renders through: Mapbox, Google and ArcGIS basemap tiles, Cloudflare Images, Unsplash, Auth0, taxonomy APIs. A developer still needs a Mapbox token. The public uploads bucket (sprites, consent documents, style uploads, forum attachments), offline tile packages, the PII classifier, and the AI data analyst are not wired locally by this plan; the first two are natural later tenants of the same storage model.
- **Public reference data stays public.** Shoreline clipping keeps reading the OSM land FlatGeobuf and H3 land archives from `uploads.seasketch.org` and `tiles.seasketch.org`. Anonymous reads of immutable public objects are allowed in every profile ([local services](local-services.md)).

## Architecture

### The picture

```
Browser ─► client :3000 ─► API :3857 (GraphQL, job worker, SQS consumer)

API calls out to:
  presigned PUT, ACL docs, deletes ─► S3 gateway :8333   (Worker)
  invoke ──────────────────────────► spatial-uploads :9001 (container)
  invoke ──────────────────────────► subdivision :9000   (container)
  POST ────────────────────────────► data-tables :3006   (host process)
  POST ────────────────────────────► overlay worker :3007 (host process)
  POST ────────────────────────────► fragment worker :3008 (host process)
  receive ◄────────────────────────  ElasticMQ :9324     (container)

Browser map and downloads read from:
  tiles, TileJSON, parquet ─► pmtiles-server :8787 (tiles host)
  FlatGeobuf, downloads ────► pmtiles-server :8788 (uploads host)
  clip, warm-cache ─────────► sketch-preprocessing-worker :8789
  public reference data ────► uploads.seasketch.org, tiles.seasketch.org

Local R2 under Miniflare, in .data/wrangler/
  buckets:    ssn-tiles-local, ssn-uploads-local
  written by: S3 gateway (for the API and the processors)
  read by:    pmtiles-server x2, sketch-preprocessing-worker (R2 bindings)
```

Postgres, Redis, the API, the client, and the map screenshotter run as they do today. Ports are defaults and each is configurable.

### Storage

**In production**, every output of the data path (tile archives, FlatGeobufs, GeoTIFFs, parquet files, ACL documents, subdivided sources) is written to the `ssn-tiles` bucket on Cloudflare R2, and raw browser uploads land in the `DataUploads` bucket on AWS S3. Every writer uses the S3 protocol, which is the only way to reach R2 from outside a Worker. Two Workers read R2 directly through bindings.

**The storage model** is simple and is already mostly in place. Every database row that refers to a stored object carries a complete URL and a bucket-qualified remote such as `r2://ssn-tiles/projects/x/public/y.pmtiles`. Code reads the stored URL rather than rebuilding it from a key and a hostname. A process may write to, delete from, or inspect only the buckets named in its own environment, which is set by CDK for a Lambda, by `wrangler` bindings for a Worker, and by `.env` or Compose locally. Any other remote is treated as read-only. There is no registry table and nothing about storage authorization is stored in the database or passed in requests. This is what lets a production row and a local row sit side by side, and it is also what a second production installation would need. Detail in [Storage model](#storage-model-in-detail).

**Locally**, the object store is Miniflare's R2, which is what `wrangler dev` provides to Workers. Several `wrangler dev` sessions share one persistence directory in the repository, so they all see the same two buckets, and the production Workers read them through their normal bindings unmodified. Because Miniflare does not expose an S3 endpoint, writers reach it through a small local-only Worker that accepts the S3 operations SeaSketch uses and performs them on the R2 binding. Detail in [Local object storage](#local-object-storage-in-detail).

### Serving

`pmtiles-server`, the Worker that serves tiles, TileJSON, downloads, and data-table queries from R2, runs locally under `wrangler dev`. In production it is one Worker deployment behind two hostnames, and the only thing the hostname changes is whether a tile archive key is answered with the raw file (uploads host) or with TileJSON and tiles (tiles host). Locally there is only `localhost`, so the same Worker code runs as two `wrangler dev` sessions, sharing one persistence directory, with one told it is the uploads host. It is one Worker and one set of data; the second session exists only because a session listens on one port. The sketch-preprocessing Worker runs the same way on 8789. Detail, including the alternatives to a second session, in [Serving](#serving-in-detail).

### Compute

The four Lambda-hosted processors and the two Node handlers run locally as follows. "Lambda emulator" means the AWS Lambda Runtime Interface Emulator, a small server inside AWS's Lambda base images that accepts an invocation over HTTP and hands it to the handler exactly as Lambda would.

| Processor | Production | Local |
| --- | --- | --- |
| Spatial uploads (`packages/spatial-uploads-handler`) | Lambda container image | The same image, under the Lambda emulator, as a Compose service. Its slow GDAL build layer is prebuilt and published to the GitHub Container Registry so that neither laptops nor CI compile it. |
| Subdivision (`packages/subdivision-worker`) | Lambda container image | The same image under the Lambda emulator, already in `compose.yaml`. |
| Overlay analysis (`packages/overlay-worker`) | Lambda (Node) | Its existing host dev server, moved to port 3007. |
| Fragment creation (`packages/fragment-worker`) | Lambda (Node) | A new host dev server on 3008, built like the overlay worker's. |
| Data tables (`packages/data-tables-handler`) | Lambda (Node) | Its existing host dev server on 3006. |
| Sketch preprocessing (`packages/sketch-preprocessing-worker`) | Cloudflare Worker | `wrangler dev` on 8789. |

The API chooses between a local handler and a deployed Lambda by environment variable, using the pattern that already exists: a `*_DEV_HANDLER` URL means local, a `*_ARN` means deployed, and neither means the feature is unavailable. `npm run dev` fills in the local URLs for the services it starts, so an empty `.env` works. Two new dev-handler variables are added, for subdivision and fragments. Detail in [Processors](#processors-in-detail).

### Results queue

Subdivision and overlay analysis report progress and results to the API through an SQS queue. Locally that queue is ElasticMQ, an SQS-compatible server that runs as one container with no credentials. The API, the overlay worker, and the subdivision container are each told where to find it. Detail in [Results queue](#results-queue-in-detail).

## Plan

### Phase 0: production groundwork

Two changes, each its own pull request and deploy, each verified on production before the next begins. Neither mentions local development; both are improvements in their own right.

**0a. Raw uploads move from S3 to R2.** A new R2 bucket, `ssn-uploads`, replaces the `DataUploads` S3 bucket. The API presigns upload URLs against R2 instead of S3; the upload processor and the data-tables handler read the staged file from R2 instead of S3; a 7-day lifecycle rule replaces the S3 expiration. Browser upload progress is unaffected because it is measured by the browser during the PUT, not by the server. After this change there is one storage backend on the data path. Verification is a checklist of real uploads on production, described in [Phase 0 verification](#phase-0-verification).

**0b. The storage model.** One additive column (`overlay_data_tables.parquet_url`, backfilled) and a set of code changes: read stored URLs instead of rebuilding them; pass URLs rather than bare object keys to the workers; act on a remote only when its bucket is one the process owns; remove the production hostnames that are written into API and worker code. The GraphQL schema does not change. Verification is the full upload, geography, sketch, and report flows on production plus the production probe.

**Exit.** Both changes deployed and verified. No data-path code contains a storage hostname or rebuilds a URL from a key. Every process's storage configuration is the endpoint, bucket names, base URLs, and credentials in its own deployed environment.

### Phase 1: spatial uploads locally

**Goal.** On a clean machine with only a Mapbox token: `setup`, `dev`, sign in, upload a shapefile, GeoJSON, GeoTIFF, or FlatGeobuf, and see it on the map next to the project's production-hosted fixture layers, with tiles and downloads served from local storage. Delete it and the objects are cleaned up. Restart and it is still there. `setup --reset` and it is gone.

**Work.** The local S3 gateway Worker and a contract test that runs each writer's real SDK calls against it. The `.data/` persistence directory and its handling in `setup --reset`. New entries in `compose.yaml` and `scripts/dev.config.mjs`. The Dockerfile split and prebuilt runtime image for the upload processor, and its Compose service with file watching. The two-session `pmtiles-server` start and its hostname variable. The storage client factory honoring a local endpoint. The subdivision processor pointed at local storage, which needs the queue, so ElasticMQ lands at the end of this phase with only the subdivision producer and the API consumer on it. Environment templates, the secrets manifest, and `README.md` instructions.

**Exit.** A fresh clone reaches a rendered local upload with an empty `.env`, in a project that also shows the fixture production layers. The spatial upload journey runs in CI without cloud credentials. `npm run status` shows every data service. A developer who sets `SPATIAL_UPLOADS_LAMBDA_ARN` and production storage credentials gets the deployed handler and nothing else changes.

### Phase 2: reporting and sketch processing locally

**Goal.** Create a geography from locally uploaded clipping layers and from production EEZ data, draw a sketch, see it clipped and its fragments created locally, and run a report whose overlay metrics are computed by the local overlay worker against local data tables and local layers.

**Work.** The overlay worker on its new port with the queue endpoint and the worker-authentication rule. The API's queue consumer on the local queue by default. The data-tables handler against local storage. The fragment worker's dev server and its dev-handler variable. The sketch-preprocessing Worker under `wrangler dev`, and a client variable for its URL in place of the two hardcoded calls. Optionally, a local mode with tile access control enabled.

**Exit.** The data-table, report-card, and sketch-clipping journeys run in CI without cloud credentials, including a clipping journey that mixes a production EEZ with a local layer. The data-profile exit criterion in [local services](local-services.md) is met. No in-scope row in [service inventory](service-inventory.md) reads "none" for its local stand-in.

---

## Storage model in detail

### What is already true

- `data_upload_outputs` has `url` (a complete URL) and `remote` (`r2://bucket/key` or `s3://bucket/key`), both required.
- `data_sources.url` is a complete URL, for hosted layers and for external services alike.
- `deleted_geojson_objects` stores a bucket and a key. The legacy GeoJSON path's `data_sources_buckets` table stores its own URL, name, region, and bucket per row. Both are left alone.
- The upload processor, the data-tables handler, and the subdivision worker already report the `url` and `remote` of each output, and the API stores them.

### What changes

**`overlay_data_tables` gains `parquet_url`.** This table has four remote columns (`parquet_remote`, `column_stats_remote`, `source_parquet_remote`, `coverage_remote`) and no URL. `overlayDataTablePlugin` currently builds the query, orgQuery, temporal-preview, and sibling URLs by putting `https://uploads.seasketch.org` in front of the key. After the change it derives them from the stored `parquet_url` by replacing the trailing path segment, so they stay on whichever origin the table was written to. The migration backfills the column from `parquet_remote` and the production uploads origin, and refuses to run if any row names a bucket other than `ssn-tiles`.

**Code reads URLs instead of rebuilding them.** The SQL functions `clipping_layers_for_geography`, `clipping_layers_for_sketch_class`, and `clipping_layer_source` return the FlatGeobuf output's stored `url` instead of a bare key produced by `data_layers_vector_object_key`. `sketches.ts`, `calculateSpatialMetricsBatch`, and `GeographyPlugin` pass those URLs to the fragment, overlay, and sketch-preprocessing workers, and the workers accept them. The `source` field of `GeographySettings.clippingLayers` becomes a URL; the workers treat a value without a scheme as a legacy key on `https://uploads.seasketch.org` for one release and then drop that. `JobStatusUpdater` stores the URL the subdivision worker reports and loses its hostname fallback. `GeographyPlugin.getBoundsForClippingLayer` decides how to read a layer from the output's `type` instead of checking whether the URL contains `tiles.seasketch.org`.

**Workers fetch per origin.** The overlay worker, the fragment worker, and the API's `sketches.ts` each hold an undici connection pool bound to `https://uploads.seasketch.org`. They change to one pool per origin, opened on demand from the URL they are given.

**Write-side origins come from two variables.** The upload processor already reads `UPLOADS_BASE_URL` and `TILES_BASE_URL` to build the URLs it records. The API and the subdivision worker adopt the same two names, replacing `R2_PUBLIC_BASE_URL` and the hostnames written into code. Origins are copied into each row at write time, as they always have been for `data_upload_outputs.url`, so a later hostname change affects only new rows.

**A process acts only on buckets it owns.** A process's environment names the buckets it may write (`R2_TILES_BUCKET`, `SPATIAL_UPLOADS_BUCKET`), the endpoint (`R2_ENDPOINT`), and the credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`). A remote whose bucket is in that set is written, deleted, or inspected with the process's own client. A remote whose bucket is not in that set is foreign: readable by its URL, otherwise skipped with a log line. Today, a cleanup task running on a laptop with a stale `.env` would delete the production object; under this rule it cannot, because `ssn-tiles` is not a bucket the laptop owns. For this to work, bucket names have to be unique across every store a database can refer to, which is why the local buckets are `ssn-tiles-local` and `ssn-uploads-local`.

**One storage client factory per runtime.** The API constructs S3 clients in eleven places, some with `{ region }` and some with `{ endpoint: R2_ENDPOINT }`. They collapse onto one factory that sets endpoint, path-style addressing when an endpoint is present, and credentials from the environment. The upload processor's `remotes.ts` and the subdivision worker's boto3 client make the same change. After phase 0a there is one kind of client on the data path.

### Why not a registry table

An earlier draft proposed a `storage_locations` table, referenced by a location id and key from every table that owns objects. It was set aside. It would have rewritten every existing row's reference, added a join to read paths that today read a single column, and moved facts that belong to a deployment (endpoints, origins) into data where they can drift from the deployment. Its one material advantage, deriving URLs for buckets a process does not own, is covered by storing the one URL that was missing.

### What a second installation gets

Its own CDK deploy, its own `wrangler.toml` bindings, its own `.env`: its own buckets and hostnames in the environment of every process it runs. Rows it writes carry its URLs and bucket names. Rows copied from another installation, such as a shared data library, carry theirs and are read-only to it. Nothing in the schema or code distinguishes one installation from another, which is the property [second install](second-install.md) asks this campaign to preserve.

## Local object storage in detail

### Miniflare's R2 as the system of record

Miniflare is the simulator `wrangler dev` runs Workers in. It provides local R2 buckets backed by files under a persistence directory. Cloudflare documents that several `wrangler dev` sessions can share one directory by passing the same `--persist-to` path, and that is how every Worker in the data profile is started: the two `pmtiles-server` sessions, the sketch-preprocessing Worker, and the S3 gateway all use `<repo>/.data/wrangler/`. They all see the same two buckets. The Workers that read R2 in production read local R2 through the same bindings, with no code change.

Local bucket names are `ssn-tiles-local` and `ssn-uploads-local`, set through each Worker's `preview_bucket_name` or an `[env.local]` block, whichever `wrangler dev` honors in local mode. The key layout under the bucket is production's, so `pmtiles-server`'s key classification, the cleanup tasks, and the ACL document paths run unmodified.

### The S3 gateway Worker

Miniflare exposes R2 only to Workers; it has no S3 endpoint. Every SeaSketch writer uses the S3 protocol, and in production that is also how it reaches R2. The local counterpart is a small Worker in a new package, `packages/local-s3-gateway`, run under `wrangler dev` on port 8333 with one binding per local bucket. It accepts path-style S3 requests and performs them on the binding: `PutObject`, `GetObject` with range requests, `HeadObject`, `DeleteObject`, `DeleteObjects`, the four multipart-upload operations, and CORS preflight. Everything else returns `501 Not Implemented`. It checks that a presigned URL has not expired and that the request's `Content-Type` matches what was signed, which is the mistake presigning actually makes; it does not verify signatures. Writers are configured with an endpoint and bucket names only, so no writer code knows the gateway exists.

The S3 SDK will not sign a request without some access key, so the local templates set `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` to fixed placeholder values. They are not a credential. The gateway is reachable only from the developer's machine and its containers.

The gateway is permanent local infrastructure, bounded by the operation list above, with a contract test that runs each writer's real SDK calls against it.

### Why a gateway, and the alternatives

The gateway exists because of one fact: Lambdas, the API, and the subdivision worker are not Workers, and the only way for a non-Worker to write to R2 is R2's S3-compatible API. Locally, Miniflare offers R2 only to Workers. Something has to translate, and there are three places to put that something.

**Keep the S3 protocol and add the local gateway** (the plan as written). Production is unchanged: writers use the S3 SDKs, which already handle streaming, retries, and multipart uploads for files of any size, in both Node and Python. The gateway is local-only code, bounded to nine operations, with a contract test. Its cost is that it is local-only code, and that it does not verify signatures.

**Update the consumers to stop using the S3 protocol.** This is not available. Outside a Worker there is no other R2 API. The only non-S3 option for a Node process is Miniflare's own programmatic API, which would be a local-only code path inside production writers, would not work from a container, and does not exist for Python.

**A SeaSketch write service: a Worker with the R2 binding, used in production and locally.** The API and the Lambdas would send objects to this Worker over HTTP, authenticated with the JWT the API already mints for the overlay engine, and the Worker would write them through its binding. Browser uploads would go to a Worker route instead of a presigned S3 URL. Locally the same Worker runs under `wrangler dev`, so there is no gateway and no local-only code at all.

| | S3 protocol plus local gateway | Write service Worker |
| --- | --- | --- |
| Local and production code paths | Different endpoint, same SDK calls; the gateway is local-only | Identical |
| Production change | None beyond phase 0 | A new component in the write path of every upload and every processor output |
| Large objects | SDK multipart handles any size | Workers cap the request body at 100 MB to 500 MB depending on plan. Multi-gigabyte archives and GeoTIFFs need a chunked upload protocol over the Worker, built and maintained by us, with clients in Node and Python |
| Credentials | R2 keys on each Lambda and the API, scoped by Cloudflare's token permissions | No R2 keys outside the Worker; the Worker can enforce per-project key prefixes and log writes |
| Browser uploads | Presigned PUT to R2, 5 GB per object, progress in the browser as today | A Worker route; the same body limit applies, so large files need the chunked protocol in the browser too |
| Operational risk | A failed upload is a Lambda or SDK error, visible in existing logs | A new service whose availability gates all writes |
| Effort | The gateway and its test | The Worker, the chunked protocol, three client libraries, migration of every writer, and the gateway's job is still done by the Worker's local instance |

The deciding factor is the request-body limit. SeaSketch's outputs routinely exceed it, so a write service cannot be a simple proxy; it has to reimplement multipart transfer that the S3 SDKs already provide. The centralized-authorization benefit is real but can be had another way: a small Worker that issues short-lived presigned S3 URLs or scoped tokens to Lambdas on request, which keeps R2 keys out of Lambdas without touching the transfer path. That is orthogonal to local emulation and can be added later without changing this plan. The recommendation is the S3 protocol with the local gateway; if a write service is built later for authorization reasons, its local instance would replace the gateway naturally.

### Large objects through the gateway

The gateway is itself a Worker, so the obvious question is why the body limit that rules out a write service does not also rule out the gateway. The answer is where the limit lives. The 100 MB to 500 MB cap is enforced by Cloudflare's edge, in front of a deployed Worker, before a request reaches the runtime. `wrangler dev` runs the same runtime on the laptop with nothing in front of it; the SDK connects to it directly. There is no edge, so there is no cap. The limits that do apply locally are R2's own per-call limits, which Miniflare enforces the same way production does: about 5 GB for a single `PutObject`, a 5 MiB minimum part size, and 10,000 parts per multipart upload. Those are the limits the writers already live within in production, so nothing is hidden locally that would surface on deploy.

Keeping that true is a matter of how the gateway is written, and three rules cover it.

**Stream every object body.** `PutObject` passes `request.body` straight into the binding's `put()`, and `UploadPart` passes it into `uploadPart()`. The gateway never calls `arrayBuffer()` or `text()` on an object body; the only bodies it reads whole are the small XML documents in `CompleteMultipartUpload` and `DeleteObjects`. `put()` with a stream needs a known length, and every S3 upload carries one, either as `Content-Length` or, for the framing described next, as `x-amz-decoded-content-length`. Miniflare's R2 writes each blob to disk as it arrives and computes the MD5 for the ETag in passing, so the gateway's memory stays flat whatever the object size.

**Unframe `aws-chunked` uploads.** The S3 SDK version pinned in this repository, and boto3 from 1.36 on, default to sending a CRC32 checksum as a trailer on `PutObject` and `UploadPart`, which means the body arrives as `Content-Encoding: aws-chunked`: hex chunk-size lines between the data, and the checksum after it. Production R2 accepts that framing, which is why the handlers work against it today without setting `requestChecksumCalculation` to `WHEN_REQUIRED`. The gateway has to do the same: strip the chunk framing and the trailer in a `TransformStream`, hand the decoded bytes to `put()`, and use `x-amz-decoded-content-length` as the object length. It is a small amount of code and the single most likely place for the gateway to be subtly wrong, so the contract test uploads through each SDK at its real default settings, not with checksums turned off. The alternative, turning checksums off in the shared client factory, would be a production change made for a local convenience, and it is not taken. Presigned PUTs from the browser are plain bodies and need no unframing.

**Read the same way.** A raw upload crosses the gateway twice: once from the browser to disk, and once when the spatial-uploads container fetches it with `GetObject` and streams it to its own disk. `GetObject` returns the R2 body stream directly, with range requests honored, so the second crossing is as flat as the first. The cost of the two crossings is throughput, not correctness; on a laptop it is bounded by local disk, and the phase 1 spike measures it.

If the spike shows the runtime buffering bodies or imposing a limit after all, the gateway does not need to be a Worker. Miniflare's programmatic API gives a Node process the same R2 binding over the same persistence directory, and a Node HTTP server has no edge in front of it either. The gateway's code would move hosts; its contract and the writers would not change.

### Known differences from S3 and R2

| Difference | Effect | Position |
| --- | --- | --- |
| No signature verification | A broken presign succeeds locally and fails in production. | Accepted for the default profile. The expiry and content-type checks cover the common mistake. Verifying signatures against the placeholder keys is an open question. |
| No lifecycle rules | The 7-day expiry on staged uploads is not emulated. | A cost control, not behavior under test. |
| Synthesized ETags and `x-amz-*` headers | The gateway builds them from R2 object metadata. | No caller inspects them beyond the SDK's multipart bookkeeping. Covered by the contract test. |
| Throughput | A multi-gigabyte upload streams through the Worker runtime twice, once on write and once when the processor reads it. No size cap applies locally; see [Large objects through the gateway](#large-objects-through-the-gateway). | Unmeasured. A spike item. |
| `aws-chunked` request bodies | The Node and Python SDKs send trailing checksums by default. The gateway unframes them. | Covered by the contract test at each SDK's default settings. |
| Several Worker processes on one persistence directory | Cloudflare recommends it. Lock contention under concurrent writes is possible. | A spike item. The fallback is a single multi-config `wrangler dev` session, which guarantees one Miniflare instance but exposes only one Worker over HTTP. |
| No `ListObjectsV2` | Not implemented. | No current writer lists objects. |

### Persistence and reset

Local R2 lives in `.data/wrangler/` at the repository root, gitignored, written by `wrangler dev` as the developer's own user. It persists across restarts and reboots. `npm run setup -- --reset` deletes it in the same step that drops the database and restores the golden snapshot, so storage and rows reset together. Without `--reset`, `setup` leaves both alone. CI starts from a fresh checkout with no `.data/`. The e2e profile uses `.data/wrangler-e2e/` and clears it at suite start.

The golden snapshot carries no objects. Its fixture layers point at production storage. A fixture that needs a local object is uploaded by the journey through the normal pipeline, which is the rule `AGENTS.md` already states.

## Serving in detail

### `pmtiles-server`

In production, `uploads.seasketch.org` and `tiles.seasketch.org` are two routes to one Worker deployment. Almost every request is handled identically on either host: data-table queries, `/properties`, FlatGeobuf and GeoTIFF downloads, ACL enforcement. The one difference is a single comparison in `index.ts`: when the hostname is the uploads host and the key is a tile-presentation key (a published PMTiles archive), the Worker returns the raw archive bytes so it can be downloaded; on the tiles host that same key is answered with TileJSON and tiles.

Locally there is only `localhost`, so that comparison needs another way to tell the two roles apart. The comparison becomes `url.host === (env.UPLOADS_HOST ?? "uploads.seasketch.org")`, and the Worker runs as two `wrangler dev` sessions against the same persistence directory: on 8787 as the tiles host, with the `overlay-data-tables` service binding, and on 8788 with `UPLOADS_HOST=localhost:8788`. The two sessions are the same code and the same data. Both listen on all interfaces so that containers can reach them. `JWKS_URL` points at the local API. `AUTH_ACL_ENABLED` defaults to `false`, matching the deployed configuration; turning it on locally is a flag.

Two ways to get by with one session were considered. Using two loopback hostnames such as `tiles.localhost` and `uploads.localhost` works in browsers, which resolve `*.localhost` to loopback on their own, but Node processes and containers depend on the operating system's resolver, which does not do that on macOS, so the overlay worker fetching a download URL would fail there without editing `/etc/hosts`. Running a tiny forwarding proxy on 8788 in front of a single session on 8787 works, because the Worker derives its URL from the `Host` header, but it is more code than a second session and one more thing to explain. A second session costs memory and startup time and no code. If either cost becomes a problem, the proxy is the fallback.

One consequence to note: a container that fetches a published archive through `host.docker.internal:8788` presents a host that is not `localhost:8788`, so `UPLOADS_HOST` should accept a comma-separated list. Today no container downloads a published archive, so this is a note rather than a requirement.

A `pmtiles-server` deployment is bound to one bucket by design, and an installation deploys one per bucket it serves.

### ACL documents

The API writes a project's tile access-control document to `acl/<namespace>/projects/<slug>.json` in its data bucket. Locally the namespace is `local` and the bucket is `ssn-tiles-local`. The existing guard that refuses to run outside production with the `prod` namespace stays in force.

### Sketch preprocessing

The Worker runs under `wrangler dev` on 8789 against the shared persistence directory, reading through its `SSN_TILES` binding. The client calls it at a URL hardcoded in `SketchEditorModal.tsx` and `GeographyAdmin.tsx`; those move to `REACT_APP_SKETCH_PREPROCESSING_URL`, which defaults to the deployed URL so the production client is unchanged, and the local client template points it at 8789. Clipping sources arrive as URLs. For a URL on its own bucket's origin it reads through the binding; for any other origin it fetches over HTTP. The existing `DEV` branch goes away.

## Processors in detail

### Spatial uploads

**The production container becomes the default local handler.** The package has a host dev server (`tsx watch server.ts` on port 3005) that depends on a hand-installed GDAL, tippecanoe, and go-pmtiles, whose versions drift from the image. Measured against the fidelity goal, that mode becomes an opt-in. The default runs the package's own image under the Lambda emulator as a Compose service named `spatial-uploads` on host port 9001, the same way `subdivision` already runs. Compose's `develop.watch` syncs the compiled `dist/` directory into the container and restarts it, while a host `tsc -b --watch` rebuilds it. The API's `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER` is set to the emulator's invoke URL, so the API sends exactly the event Lambda would receive. The package README already documents this recipe; it becomes what the start command does.

**The slow part of the image is prebuilt.** The Dockerfile compiles GDAL 3.9.2, PROJ, GEOS, HDF5, and NetCDF from source and installs tippecanoe, go-pmtiles, rclone, unrar, fiona, and rasterio, which takes tens of minutes. It splits into a runtime stage containing all of that, published to the GitHub Container Registry by a workflow that runs when that stage changes, and an application stage that starts from the published runtime image and copies in `dist/`, which takes seconds. The production Lambda image is built from the same two stages, so the local handler and the deployed one run the same binaries. This also answers the open question in [local services](local-services.md) about whether the image build is too slow for pull-request CI.

**Container configuration.** The container receives the same environment CDK gives the Lambda in production (endpoint, bucket names, base URLs, credentials, database URL), with local values set in `compose.yaml`. One addition is specific to containers: a process inside a container reaches the host's `localhost` as `host.docker.internal`, so the container gets a `STORAGE_ORIGIN_MAP` of `publicOrigin=reachableOrigin` pairs that the client factory and HTTP fetches apply before connecting. `compose.yaml` sets `extra_hosts: host-gateway` so that name resolves on Linux Docker Engine as it does on Docker Desktop. In production the map is empty and the code does nothing.

**Host mode stays available** as `npm run dev -- --only spatial-uploads-host` for someone iterating on the handler's TypeScript with the toolchain installed. It is not started by default and is not used in CI.

### Subdivision

The Compose service already exists. The API gains `SUBDIVISION_WORKER_DEV_HANDLER`, with the emulator's invoke URL as its local default, and `preprocessSource` uses it under the same rule as the other handlers. The worker's `R2_PUBLIC_BASE_URL` becomes `UPLOADS_BASE_URL`, set by CDK in production and by Compose locally. It reads the queue endpoint from `SQS_ENDPOINT` and applies the same `STORAGE_ORIGIN_MAP` as the upload container. It always reports each output's `url` and `remote`.

### Overlay analysis

The host dev server (`tsx watch server.ts`) moves from port 3006, which collides with the data-tables handler, to 3007. It gains the per-origin connection pools, `SQS_ENDPOINT`, and the worker-authentication rule below, and it accepts clipping sources as URLs. `OVERLAY_WORKER_DEV_HANDLER` is filled in by `npm run dev`. Its land and H3 inputs stay on their production public URLs; a developer testing a modified shoreline points those variables at a local upload's URL.

### Data tables

Already a host process on 3006 configured by its own `.env`. Locally its endpoint is the gateway and its bucket is `ssn-tiles-local`. The parquet it writes is served by the tiles-host `pmtiles-server` through the `overlay-data-tables` binding, which is the production path. `TAXONOMY_PROXY_URL` is a third-party dependency and stays external.

### Fragment creation

The package is Lambda-only today. It gains a `server.ts` like the overlay worker's: an HTTP server on 3008 that reads a JSON Lambda event and calls `lambdaHandler`. The four invocations in `sketches.ts` go through a new `FRAGMENT_WORKER_DEV_HANDLER` with unchanged payloads. It accepts clipping sources as URLs, uses per-origin pools, and follows the worker-authentication rule. Deployment is unchanged.

### Worker authentication

The overlay, fragment, and subdivision workers fetch a JWT from AWS Secrets Manager (`OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN`) so they can read private hosted data from `pmtiles-server`, and they throw when the secret is unreachable. Locally, `pmtiles-server` runs with access control off, as production does today, so the token adds nothing. The workers adopt the rule the API already follows: when the secret ARN is unset outside production, send no `Authorization` header and log once; in production, throw a misconfiguration error. Secrets Manager is not emulated. If a local mode with access control on is wanted later, the API, which already mints these tokens, can hand one to the local workers through an environment variable that `npm run dev` sets at start.

### Client

Layer, tile, and download URLs come from the database, so a local upload renders from `localhost:8787` and `8788` while a production layer in the same project keeps rendering from `tiles.seasketch.org`. The check in `tilesAuth.ts` that decides whether to attach an access token already includes `localhost`. The presigned upload flow is untouched. The only new client variable is `REACT_APP_SKETCH_PREPROCESSING_URL`.

## Results queue in detail

Subdivision and overlay analysis stay on Lambda and report through SQS, so the local profile emulates SQS. ElasticMQ runs as a Compose service (`softwaremill/elasticmq-native`, port 9324, no credentials). Its queue, `overlay-engine-results`, is defined in a committed `elasticmq.conf`, with the e2e profile's queue beside it. The API's local `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL` default is `http://localhost:9324/000000000000/overlay-engine-results`.

A queue URL names the queue; `SQS_ENDPOINT` (or the SDK's `AWS_ENDPOINT_URL_SQS`) says where to send the request. The API's consumer, the overlay worker on the host, and the subdivision container each get the endpoint for their own network position, and all of them carry the same queue URL in payloads. The subdivision worker, which currently parses the AWS region out of the queue URL, falls back to `AWS_REGION` when the URL is not an AWS one.

Messages are lost if the container restarts. That is acceptable: the queue carries progress for jobs whose state of record is Postgres, and a job that misses its completion message is already handled as a timeout. This settles the open question in [local services](local-services.md) about per-developer AWS queues versus an emulator in favor of the emulator, because the alternative keeps AWS credentials in the default profile.

## Configuration in detail

`npm run dev` already injects `SCREENSHOTTER_URL` into the API when it starts the local screenshotter. The same mechanism is extended: for each local service it starts, it injects that service's default URL into the processes that call it, unless the caller's `.env` already names a target. The environment templates carry the local storage values. New variables are added to `packages/api/env-manifest.json` with the class shown, and the manifest's CI check rejects every value in the override column.

| Integration | Local default | Production override (never in CI) | Manifest class |
| --- | --- | --- | --- |
| Storage | `R2_ENDPOINT=http://localhost:8333`, `R2_TILES_BUCKET=ssn-tiles-local`, `SPATIAL_UPLOADS_BUCKET=ssn-uploads-local`, `UPLOADS_BASE_URL=http://localhost:8788`, `TILES_BASE_URL=http://localhost:8787`, placeholder `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` | The production endpoint, bucket names, origins, and real keys | public-config / production-secret |
| Workers under `wrangler dev` | Gateway on 8333; `pmtiles-server` on 8787 and 8788 with `UPLOADS_HOST`; sketch preprocessing on 8789; all with `--persist-to .data/wrangler` | Not applicable; production Workers are deployments | public-config |
| Spatial uploads | `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER=http://localhost:9001/2015-03-31/functions/function/invocations` | `SPATIAL_UPLOADS_LAMBDA_ARN` | public-config / production-secret |
| Subdivision | `SUBDIVISION_WORKER_DEV_HANDLER=http://localhost:9000/2015-03-31/functions/function/invocations` | `SUBDIVISION_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Data tables | `DATA_TABLES_LAMBDA_DEV_HANDLER=http://localhost:3006` (exists today) | `DATA_TABLES_HANDLER_LAMBDA_ARN` | public-config / production-secret |
| Overlay analysis | `OVERLAY_WORKER_DEV_HANDLER=http://localhost:3007` | `OVERLAY_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Results queue | `OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL=http://localhost:9324/000000000000/overlay-engine-results`, `SQS_ENDPOINT=http://localhost:9324` | An `https://sqs.<region>.amazonaws.com/…` URL, such as the per-developer queues `SQSStack` provisions | public-config / per-environment-name |
| Fragment creation | `FRAGMENT_WORKER_DEV_HANDLER=http://localhost:3008` | `FRAGMENT_WORKER_LAMBDA_ARN` | public-config / production-secret |
| Sketch preprocessing | `REACT_APP_SKETCH_PREPROCESSING_URL=http://localhost:8789` | The deployed `workers.dev` URL | public-config |
| Worker token | `OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN` unset, so no header is sent | The ARN, with AWS credentials | production-secret |
| Containers | In `compose.yaml`: `STORAGE_ORIGIN_MAP`, `SQS_ENDPOINT=http://elasticmq:9324`, `extra_hosts: host-gateway` | Not applicable | public-config |

Mixing is allowed and well-defined. Setting `SPATIAL_UPLOADS_LAMBDA_ARN` sends uploads through the deployed handler, which writes where its own CDK environment says (production storage) and reports production URLs and `ssn-tiles` remotes. Those rows render and clip locally like any other production-hosted row, and the local cleanup task treats them as foreign. The staged upload has to be somewhere the deployed handler can read, so this override only makes sense together with the production `SPATIAL_UPLOADS_BUCKET`, `R2_ENDPOINT`, and keys in the API's `.env`.

## Startup in detail

- `compose.yaml` gains `elasticmq` and `spatial-uploads` in a `data` profile (the existing `workers` profile folds into it), each with a healthcheck and `extra_hosts`. There is no storage container.
- `scripts/dev.config.mjs` gains `s3-gateway`, `pmtiles-tiles`, `pmtiles-uploads`, `sketch-preprocessing`, `fragment-worker`, `spatial-uploads-tsc` (the host `tsc -b --watch` that feeds the container), and the moved `overlay-worker`, each with a readiness probe and dependencies: the API waits for the gateway and the queue; the Workers wait for the API so they can fetch its JWKS. Host-mode `spatial-uploads` stays as an opt-in entry.
- `npm run dev` runs the core and data profiles. `--profile core` is the opt-out. `--ci` starts the data services once, without watchers. The e2e profile starts the data services on offset ports with `--persist-to .data/wrangler-e2e` and its own queue, so a Playwright run can execute an upload journey beside a developer's own stack.
- `npm run status` lists the new ports and `npm run logs -- <service>` works for every entry.
- The `Dev: stack` VS Code task already runs `npm run dev` and inherits the new default. A `Dev: core only` task is added for the opt-out.
- Host requirements are Docker and Node, as today. No GDAL, tippecanoe, Java, or Python on the host.

## Fidelity

| Difference from production in the default local profile | Why it is acceptable |
| --- | --- |
| Miniflare's R2 instead of R2 | The Workers that read R2 run the same code against the same binding API. |
| Writers reach R2 through the local S3 gateway instead of R2's own S3 endpoint | Same SDK calls, same protocol subset, same client factory. Only the endpoint differs. Signatures are not verified. |
| HTTP and `localhost` ports instead of hostnames | Transport only. The hostname-dependent behavior in `pmtiles-server` is exercised through `UPLOADS_HOST`. |
| Lambda emulator instead of Lambda | Same image, same event, same handler entry point. The emulator does not enforce the 15-minute timeout or the memory limit; Compose's `mem_limit` can approximate the latter. The API awaits the local call rather than firing an asynchronous invoke, which is already how the dev-handler path behaves. |
| ElasticMQ instead of SQS | Same SDK calls. Messages are lost on restart; job state of record is Postgres. |
| No Cloudflare edge cache in front of `pmtiles-server` | Cache behavior is not under test locally. |
| Workers send no access token | Matches `pmtiles-server` with access control off, which is production's current setting. |
| Overlay, fragment, and data-table processors as host Node processes rather than Lambda containers | Pure Node code with no native toolchain; already the dev pattern for two of the three. They can be containerized with the same emulator recipe if a discrepancy ever appears. |

## Phase 0 verification

**0a.** On production, after deploy: upload a shapefile, a GeoJSON, a GeoTIFF, a FlatGeobuf, and a data table; upload a file larger than 1 GB and watch the progress bar; cancel an upload partway through; replace a PMTiles archive; confirm from handler logs that the staged file was read from R2; confirm the lifecycle rule exists on the bucket. The production probe gains a read-only check that `presignedUploadUrl` returns an R2 host. Rollback is the previous bucket name and client in the environment. The S3 bucket stays, empty, until its expiration has drained it, and is removed by a later infrastructure change. `DataUploadsNormalized`, which appears only in infrastructure configuration and not in handler code, is confirmed unused and removed.

**0b.** On production, after deploy: the full upload, data-table, geography, sketch, and report flows; a layer deletion with its cleanup confirmed in R2; the production probe green; a query confirming every `overlay_data_tables.parquet_url` resolves. Rollback is the previous API image; the added column is inert to it.

## Starting point (October 2026)

[Service inventory](service-inventory.md) is the full table. The facts that shaped this design:

- Which bucket a process writes, and which hostnames it is served from, are environment variables on the API and Lambdas and hostnames written into code in the API (`GeographyPlugin`, `calculateSpatialMetricsBatch`, `JobStatusUpdater`, `sketches.ts`, `metadataParserPlugin`, `replacePMTilesPlugin`, `reportsPlugin`, `overlayDataTablePlugin`), in both Node workers, in the subdivision worker, and in `pmtiles-server`'s routing. A process can address one bucket per role, and it has to be production's.
- Rows are mostly self-describing already. `data_sources.url` and `data_upload_outputs.url` are complete URLs; `data_upload_outputs.remote` and the `overlay_data_tables` remote columns are bucket-qualified. But `data_layers_vector_object_key` strips the bucket off to hand the workers a bare key, which they prefix with a constant host, and `overlayDataTablePlugin` builds URLs the same way.
- Every writer speaks the S3 protocol: the API with aws-sdk v2, the Node handlers with SDK v3, the subdivision worker with boto3. Only two Workers read R2 through bindings, and both call only `get` and `head`.
- Upload progress is measured in the browser: `ProjectBackgroundJobManager` PUTs to the presigned URL with axios and writes `onUploadProgress` into the Apollo cache.
- Overlay and subdivision results arrive over SQS. The API's consumer receives and deletes messages, so two developers on one queue take each other's results. Development uses a shared AWS queue today.
- The overlay, fragment, and subdivision workers read a JWT from Secrets Manager and throw when it is unreachable. The API already skips the token when the ARN is unset outside production.
- Local entry points are uneven: spatial uploads has a host server and a slow production image; the overlay worker's host server shares a port with the data-tables handler; the subdivision container exists but the API only knows its ARN; the fragment worker is Lambda-only; `pmtiles-server`'s `wrangler dev` recipe is not started by anyone; the sketch-preprocessing Worker's URL is hardcoded in two client components.
- `npm run dev` runs Compose for containers and `concurrently` for host processes, with profiles, readiness probes, logs, and status, and already injects one local service URL into the API.
- `npm run setup -- --reset` restores the golden snapshot. There is no object store to reset.

## Proposed decisions

To be moved into *Decisions* with the month when accepted; anything implementation overturns is corrected in place.

- Rows that reference objects are self-contained: a complete `url` and a bucket-qualified `remote`, with `overlay_data_tables.parquet_url` added to complete the set. There is no registry table. Code reads stored URLs and never reconstructs them. Hostnames written into data-path code are removed, which narrows the "hostnames are later debt" stance in [second install](second-install.md) to the hostnames this plan does not touch.
- A process may write, delete, or inspect only buckets named in its own environment. Every other remote is read-only by URL. Nothing about storage authorization lives in the database or in request payloads. Bucket names are unique across every store a database can refer to.
- Raw uploads move from the `DataUploads` S3 bucket to an R2 bucket, reached by presigned PUT through R2's S3 API, deployed and verified on production before anything else in this plan. No Worker in the upload path.
- Spatial uploads, subdivision, overlay analysis, and fragment creation stay on Lambda with SQS. Cloudflare is used for storage and serving.
- Local object storage is Miniflare's R2, shared across `wrangler dev` sessions through one persistence directory under `.data/`, with local bucket names. Writers reach it through a local-only S3 gateway Worker. There is no S3-compatible storage container and no R2 shim in production Workers. A production write-service Worker was considered and set aside because of the Workers request-body limit; see [Why a gateway](#why-a-gateway-and-the-alternatives).
- The spatial-uploads handler's default local form is the production container under the Lambda emulator, built from a prebuilt runtime image that production also uses. Host mode is an opt-in.
- `pmtiles-server` runs as two sessions covering the tiles and uploads hosts.
- The results queue is ElasticMQ locally. AWS credentials leave the default profile.
- Workers follow the API's rule for the overlay-engine token: no secret ARN outside production means no header.
- `SUBDIVISION_WORKER_DEV_HANDLER` and `FRAGMENT_WORKER_DEV_HANDLER` join the dev-handler pattern; the fragment worker gets a local server; the overlay worker moves to port 3007.
- The client gets one new variable, `REACT_APP_SKETCH_PREPROCESSING_URL`.
- `npm run dev` starts the data path by default and `--profile core` opts out.
- The golden snapshot carries no objects. Fixtures keep their production URLs. Local objects are created through the pipeline.

## Open questions

- *(Phase 0b)* Whether the subdivision worker's result message needs a compatibility window during the deploy, since a worker invoked before the API deploy may omit the URL the new `JobStatusUpdater` requires. Deploy the worker first, or accept both shapes for one release.
- *(Phase 0a)* The R2 bucket name. `ssn-uploads` is used above; it should not be confused with `uploads.seasketch.org`, which serves `ssn-tiles`.
- *(Phase 1)* A spike on Miniflare: several `wrangler dev` sessions on one persistence directory under concurrent gateway writes and `pmtiles-server` reads, and gateway throughput for a multi-gigabyte multipart upload. Pass criteria: the exact SDK calls the handlers make succeed at their default checksum settings, the API's presigned PUT works as the browser sends it, a 3 GB raw upload by presigned PUT and a multipart output above 500 MB both complete with the gateway process's memory flat, and no SQLite lock errors appear across ten consecutive uploads.
- *(Phase 1)* Whether `preview_bucket_name` or an `[env.local]` block is the right way to give the Workers local bucket names under `wrangler dev` without touching their production configuration.
- *(Phase 1)* Whether the prebuilt runtime image is pinned by digest in the Dockerfile or tracked as `latest`.
- *(Phase 1)* Whether the gateway should verify signatures against the placeholder keys.
- *(Phase 2)* Whether a local mode with tile access control enabled is built in this phase or deferred until the multi-level admin journeys need it.
- *(Phase 2)* Whether the overlay, fragment, and data-table processors should also get container forms under the Lambda emulator for closer parity. The default position is that host Node processes are sufficient until a discrepancy is observed.

## Exit criteria

- **Phase 0:** Raw uploads land in R2 on production. No data-path code holds a storage hostname or reconstructs a URL from a key. `parquet_url` is populated for every data table. The production probe is green after each deploy.
- **Phase 1:** A clean machine with Docker, Node, and a `.env` containing a Mapbox token runs `setup` then `dev`, uploads a layer, and renders it from local storage beside production-hosted fixture layers. The layer survives `dev` restarts and is removed by `setup --reset`. CI runs the upload journey without cloud credentials.
- **Phase 2:** The same machine builds a geography from a local layer and a production EEZ, clips a sketch, creates its fragments, and renders a report with overlay metrics, with every SeaSketch process local. CI runs the data-table, report-card, and sketch-clipping journeys without cloud credentials. The data-profile exit criterion in [local services](local-services.md) is met and marked.
- **Throughout:** For each processor, the variable that points at production is documented beside its local default, and the CI configuration check rejects it. No pull request adds a storage hostname to the data path or reconstructs a URL from a key.

## Glossary

- **R2** is Cloudflare's object store. A Worker reaches it through a binding; anything else reaches it through its S3-compatible API.
- **Miniflare** is the simulator `wrangler dev` runs Workers in. It provides local R2 buckets backed by files, reachable only through bindings.
- **Lambda emulator** is the AWS Lambda Runtime Interface Emulator, a small server inside AWS's Lambda base images that accepts an invocation over HTTP (`POST /2015-03-31/functions/function/invocations`) and delivers it to the handler as Lambda would.
- **GitHub Container Registry** (`ghcr.io`) is an image registry attached to the GitHub organization that GitHub Actions can push to with its default token.
- **ElasticMQ** is an SQS-compatible queue server that runs as one container with no credentials.
- **Remote** is SeaSketch's existing bucket-qualified object reference, `r2://<bucket>/<key>` or `s3://<bucket>/<key>`.

## Effect on the other topic files

On acceptance: [local services](local-services.md) resolves its phase 3 open questions (an emulator over per-developer AWS queues; local R2 under Miniflare over fixture archives; a prebuilt runtime image for CI build time) and its phase 5 question (fragment and subdivision get local entry points here), and its *Profiles* section records that the data profile is the `npm run dev` default. [Second install](second-install.md) replaces the data-path items in its known-debt paragraph with a pointer to the storage model. [Strategy](strategy.md) phase 3 gains the phase 0 production groundwork as a prerequisite. [Service inventory](service-inventory.md) is updated row by row as each stand-in ships. [Secrets](secrets-management.md) gains the new manifest entries. The repo `README.md` and the package READMEs receive the operating instructions; this file does not.
