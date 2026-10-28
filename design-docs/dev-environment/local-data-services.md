# Local data services

> Part of the [2026 campaign record](README.md). Status: accepted October 2026; implementation in progress. The working implementation sketch is [`.cursor/plans/local_data_services.plan.md`](../../.cursor/plans/local_data_services.plan.md); this file is the record and wins where they disagree.

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
  presigned PUT, ACL docs, deletes ─► local R2 S3 API :8333 (wrangler)
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
  buckets:    ssn-tiles-local, ssn-spatial-uploads-tmp-local
  written by: its S3 API on :8333 (the API and the processors)
  read by:    pmtiles-server x2, sketch-preprocessing-worker (R2 bindings)
```

Postgres, Redis, the API, the client, and the map screenshotter run as they do today. Ports are defaults and each is configurable.

### Storage

**In production**, every output of the data path (tile archives, FlatGeobufs, GeoTIFFs, parquet files, ACL documents, subdivided sources) is written to the `ssn-tiles` bucket on Cloudflare R2, and raw browser uploads land in the `DataUploads` bucket on AWS S3. Every writer uses the S3 protocol, which is the only way to reach R2 from outside a Worker. Two Workers read R2 directly through bindings.

**The storage model** is simple and is already mostly in place. Every database row that refers to a stored object carries a complete URL and a bucket-qualified remote such as `r2://ssn-tiles/projects/x/public/y.pmtiles`. Code reads the stored URL rather than rebuilding it from a key and a hostname. A process may write to, delete from, or inspect only the buckets named in its own environment, which is set by CDK for a Lambda, by `wrangler` bindings for a Worker, and by `.env` or Compose locally. Any other remote is treated as read-only. There is no registry table and nothing about storage authorization is stored in the database or passed in requests. This is what lets a production row and a local row sit side by side, and it is also what a second production installation would need. Detail in [Storage model](#storage-model-in-detail).

**Locally**, the object store is Miniflare's R2, which is what `wrangler dev` provides to Workers. Several `wrangler dev` sessions share one persistence directory in the repository, so they all see the same two buckets, and the production Workers read them through their normal bindings unmodified. Since July 2026 `wrangler dev` can also serve a local R2 bucket over an S3-compatible API with real SigV4 verification, so the API, the Lambdas' containers, and the subdivision worker write to it with the same SDK calls they use against R2 in production, and no SeaSketch code stands in between. The one adjustment is a client setting that turns off the AWS SDK's trailing checksums, which R2 accepts either way. Detail in [Local object storage](#local-object-storage-in-detail).

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

Two changes, each its own pull request. Both are implemented and exercised from a laptop against the real staging bucket before either is deployed. Production deploy is manual, and the cutover is a hard switch of bucket name and client once phase 0 is ready. Neither change mentions local development; both are improvements in their own right.

**0a. Raw uploads move from S3 to R2.** A new R2 bucket, `ssn-spatial-uploads-tmp`, replaces the `DataUploads` S3 bucket. The API presigns upload URLs against R2 instead of S3; the upload processor and the data-tables handler read the staged file from R2 instead of S3. A lifecycle rule deletes objects after 24 hours and aborts incomplete multipart uploads after 24 hours. The existing account-wide R2 token is reused. Browser upload progress is unaffected because it is measured by the browser during the PUT, not by the server. After this change there is one storage backend on the data path. Verification is a checklist of real uploads on production, described in [Phase 0 verification](#phase-0-verification).

**0b. The storage model.** One additive column (`overlay_data_tables.parquet_url`, backfilled) and a set of code changes: read stored URLs instead of rebuilding them; pass URLs rather than bare object keys to the workers; act on a remote only when its bucket is one the process owns; remove the production hostnames that are written into API and worker code. The schema adds `GeographyClippingLayer.fgbUrl` and keeps `objectKey`, deprecated, returning the same remote as before. Deploy order is in [Phase 0b deploy order](#phase-0b-deploy-order). Verification is the full upload, geography, sketch, and report flows on production plus the production probe.

**Exit.** Both changes deployed and verified. No data-path code contains a storage hostname or rebuilds a URL from a key. Every process's storage configuration is the endpoint, bucket names, base URLs, and credentials in its own deployed environment.

### Phase 1: spatial uploads locally

**Goal.** On a clean machine with only a Mapbox token: `setup`, `dev`, sign in, upload a shapefile, GeoJSON, GeoTIFF, or FlatGeobuf, and see it on the map next to the project's production-hosted fixture layers, with tiles and downloads served from local storage. Delete it and the objects are cleaned up. Restart and it is still there. `setup --reset` and it is gone.

**Work.** A config-only `wrangler` project that serves the two local buckets over the S3 API, and a contract test that runs each writer's real SDK calls against it. The `.data/` persistence directory and its handling in `setup --reset`. New entries in `compose.yaml` and `scripts/dev.config.mjs`. The Dockerfile split and prebuilt runtime image for the upload processor, and its Compose service with file watching. The two-session `pmtiles-server` start and its hostname variable. The storage client factory honoring a local endpoint. The subdivision processor pointed at local storage, which needs the queue, so ElasticMQ lands at the end of this phase with only the subdivision producer and the API consumer on it. Environment templates, the secrets manifest, and `README.md` instructions.

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

**Code reads URLs instead of rebuilding them.** The SQL functions `clipping_layers_for_geography`, `clipping_layers_for_sketch_class`, and `clipping_layer_source` return the FlatGeobuf output's stored `url` as `fgb_url` instead of a bare key produced by `data_layers_vector_object_key`. `GeographyClippingLayer.objectKey` stays, marked `@deprecated`, and still returns `data_upload_outputs.remote`. The previous client selects that field on every geography query and strips the scheme and host to get the clipping key, so removing it fails those queries for every open browser until the new client is deployed and the page is reloaded. `sketches.ts`, `calculateSpatialMetricsBatch`, and `GeographyPlugin` pass those URLs to the fragment, overlay, and sketch-preprocessing workers, and the workers accept them. The `source` field of `GeographySettings.clippingLayers` is a URL once the API is deployed. Sketch preprocessing still accepts a bare key on `https://uploads.seasketch.org`, because a stale browser sends the key it stripped from `objectKey`, and a layer with no FlatGeobuf URL still sends `vectorObjectKey`. The refreshed client sends `fgbUrl` unchanged. `JobStatusUpdater` stores the `publicUrl` the subdivision worker reports, and rejects a result that omits it. The subdivision Lambda is deployed first; it builds `publicUrl` from `UPLOADS_BASE_URL`. `GeographyPlugin.getBoundsForClippingLayer` decides how to read a layer from the output's `type` instead of checking whether the URL contains `tiles.seasketch.org`.

**Workers fetch per origin.** The overlay worker, the fragment worker, and the API's `sketches.ts` each hold an undici connection pool bound to `https://uploads.seasketch.org`. They change to one pool per origin, opened on demand from the URL they are given.

**Write-side origins come from two variables.** The upload processor already reads `UPLOADS_BASE_URL` and `TILES_BASE_URL` to build the URLs it records. The API and the subdivision worker adopt the same two names, replacing `R2_PUBLIC_BASE_URL` and the hostnames written into code. Origins are copied into each row at write time, as they always have been for `data_upload_outputs.url`, so a later hostname change affects only new rows.

**A process acts only on buckets it owns.** A process's environment names the buckets it may write (`R2_TILES_BUCKET`, `SPATIAL_UPLOADS_BUCKET`), the endpoint (`R2_ENDPOINT`), and the credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`). A remote whose bucket is in that set is written, deleted, or inspected with the process's own client. A remote whose bucket is not in that set is foreign: readable by its URL, otherwise skipped with a log line. Today, a cleanup task running on a laptop with a stale `.env` would delete the production object; under this rule it cannot, because `ssn-tiles` is not a bucket the laptop owns. For this to work, bucket names have to be unique across every store a database can refer to, which is why the local buckets are `ssn-tiles-local` and `ssn-spatial-uploads-tmp-local`.

**One storage client factory per runtime.** The API constructs S3 clients in eleven places, some with `{ region }` and some with `{ endpoint: R2_ENDPOINT }`. They collapse onto one factory that sets endpoint, path-style addressing when an endpoint is present, credentials from the environment, and `requestChecksumCalculation: "WHEN_REQUIRED"` (see [What was verified](#what-was-verified) for why it matters locally). The upload processor's `remotes.ts` and the subdivision worker's boto3 client make the same change. After phase 0a there is one kind of client on the data path.

### Why not a registry table

An earlier draft proposed a `storage_locations` table, referenced by a location id and key from every table that owns objects. It was set aside. It would have rewritten every existing row's reference, added a join to read paths that today read a single column, and moved facts that belong to a deployment (endpoints, origins) into data where they can drift from the deployment. Its one material advantage, deriving URLs for buckets a process does not own, is covered by storing the one URL that was missing.

### What a second installation gets

Its own CDK deploy, its own `wrangler.toml` bindings, its own `.env`: its own buckets and hostnames in the environment of every process it runs. Rows it writes carry its URLs and bucket names. Rows copied from another installation, such as a shared data library, carry theirs and are read-only to it. Nothing in the schema or code distinguishes one installation from another, which is the property [second install](second-install.md) asks this campaign to preserve.

## Local object storage in detail

### Miniflare's R2 as the system of record

Miniflare is the simulator `wrangler dev` runs Workers in. It provides local R2 buckets backed by files under a persistence directory. Cloudflare documents that several `wrangler dev` sessions can share one directory by passing the same `--persist-to` path, and that is how every Worker in the data profile is started: the two `pmtiles-server` sessions, the sketch-preprocessing Worker, and the storage session described next all use `<repo>/.data/wrangler/`. They all see the same two buckets. The Workers that read R2 in production read local R2 through the same bindings, with no code change.

Local bucket names are `ssn-tiles-local` and `ssn-spatial-uploads-tmp-local`, set through each Worker's `preview_bucket_name` or an `[env.local]` block, whichever `wrangler dev` honors in local mode. The key layout under the bucket is production's, so `pmtiles-server`'s key classification, the cleanup tasks, and the ACL document paths run unmodified.

### The local S3 API

Every SeaSketch writer outside a Worker uses the S3 protocol, and in production that is also how it reaches R2. Until mid-2026 Miniflare exposed R2 only to Workers, which would have meant writing and owning an S3-to-binding translation layer. That is no longer necessary. `wrangler` 4.115.0 (Miniflare 4.20260722.1, July 2026) added a local S3-compatible API for R2 buckets: an `r2_buckets` entry configured with `local_dev.experimental_s3_credentials` is served at `/cdn-cgi/local/r2/s3/<bucket_name>/` on the session's port, with AWS Signature Version 4 verified on both `Authorization` headers and presigned URLs. It implements `GetObject`, `HeadObject`, `PutObject`, `CopyObject`, `DeleteObject`, `DeleteObjects`, `ListObjects`, `ListObjectsV2`, `HeadBucket`, `ListBuckets`, and the five multipart operations, and it mirrors R2's own status codes, error documents, and unsupported-header screening. CORS preflight is answered permissively. The version of `wrangler` already installed in this repository (4.151.3) has it.

The plan uses it through a small config-only project, `packages/local-r2`: a `wrangler.jsonc` naming the two local buckets with their credentials, a Worker whose `fetch` returns 404, and a `dev` script that runs `wrangler dev --port 8333 --persist-to ../../.data/wrangler`. Writers get `R2_ENDPOINT=http://localhost:8333/cdn-cgi/local/r2/s3` and path-style addressing, which the client factory already uses for R2. The credentials in the config are fixed local strings; the same strings go in the local `.env` as `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. They authorize nothing outside the developer's machine, and because signatures are really verified, a broken presign fails locally the way it fails in production.

This is not a shim SeaSketch owns. It is upstream Cloudflare code, tested against R2's real responses, under the `experimental` label. The label means the configuration key could be renamed in a future `wrangler` release, as it already was once (`experimental_local_s3_credentials` became `local_dev.experimental_s3_credentials`). That is a one-line change in one file when it happens, and the `wrangler` version is pinned in `package.json`.

### What was verified

The claims above were checked by running the writers' real calls against it, on the installed `wrangler`, with a 20 MB and a 600 MB file:

- `@aws-sdk/client-s3` 3.1155 `PutObject` with a file stream, `HeadObject`, `GetObject`, `GetObject` with a `Range`, `DeleteObject`, and `@aws-sdk/lib-storage` `Upload` of 600 MB in 50 MB parts, the calls in `remotes.ts`. All round-tripped byte-for-byte; the multipart ETag has the usual `-12` part suffix.
- A presigned `PutObject` URL from `@aws-sdk/s3-request-presigner` and from `aws-sdk` v2's `getSignedUrlPromise`, used by a plain `fetch` the way the browser uses it, and the CORS preflight the browser sends first.
- `aws-sdk` v2 `putObject` with a buffer and with a stream plus `ContentLength`, `headObject`, `deleteObject`, and `deleteObjects`, the calls the API and its cleanup tasks make.
- `boto3` 1.34.140 `upload_file` with a progress callback, the call in the subdivision worker. The 600 MB file went as 75 parts with 2,400 progress callbacks.
- A second `wrangler dev` session with a plain binding on the same persistence directory read both objects back through the binding, which is what `pmtiles-server` will do.
- The `workerd` process stayed under 95 MB of resident memory through the 600 MB uploads, so bodies stream to disk rather than through memory, and nothing capped the request size.

One call failed at the SDK's default settings: `PutObject` with a stream body from `@aws-sdk/client-s3`. Since version 3.729 the SDK sends a CRC32 checksum as a trailer on streamed uploads, which turns the body into `Content-Encoding: aws-chunked` with no `Content-Length`. Miniflare passes the body to the binding without unframing it, and the binding refuses a stream of unknown length. Multipart parts are buffers, so `lib-storage` is unaffected, and `aws-sdk` v2 and the pinned `boto3` never use trailers. The fix is `requestChecksumCalculation: "WHEN_REQUIRED"` on the SDK v3 client, after which the same call sends `Content-Length` and an unsigned payload and succeeds. Cloudflare recommended that setting for R2 when the SDK changed its defaults in early 2025, before R2 accepted the new encoding; R2 now accepts both, so it is safe in production and belongs in the shared client factory for every environment rather than as a local branch. The trailer was an SDK default, not a SeaSketch choice, and R2 computes its own ETag regardless. An upstream issue asking Miniflare to unframe `aws-chunked` bodies is worth filing, and if it lands the setting can stay or go.

### Why the S3 protocol, and the alternatives

The reason to keep the S3 protocol at all is one fact: Lambdas, the API, and the subdivision worker are not Workers, and the only way for a non-Worker to write to R2 is R2's S3-compatible API. Given that, there were three ways to serve the local side.

**Keep the S3 protocol and use Miniflare's S3 API** (the plan as written). Production is unchanged: writers use the S3 SDKs, which already handle streaming, retries, and multipart uploads for files of any size, in Node and Python. Locally the endpoint is upstream code, with a contract test in this repository that runs each writer's real calls against it so that a `wrangler` upgrade cannot break the data path silently. Before July 2026 this option meant writing the translation layer ourselves, which was the plan's earlier form.

**Update the consumers to stop using the S3 protocol.** This is not available. Outside a Worker there is no other R2 API. The only non-S3 option for a Node process is Miniflare's own programmatic API, which would be a local-only code path inside production writers, would not work from a container, and does not exist for Python.

**A SeaSketch write service: a Worker with the R2 binding, used in production and locally.** The API and the Lambdas would send objects to this Worker over HTTP, authenticated with the JWT the API already mints for the overlay engine, and the Worker would write them through its binding. Browser uploads would go to a Worker route instead of a presigned S3 URL. Locally the same Worker runs under `wrangler dev`.

| | S3 protocol plus Miniflare's S3 API | Write service Worker |
| --- | --- | --- |
| Local and production code paths | Different endpoint, same SDK calls; nothing local-only in SeaSketch | Identical |
| Production change | None beyond phase 0 and one client setting | A new component in the write path of every upload and every processor output |
| Large objects | SDK multipart handles any size | Workers cap the request body at 100 MB to 500 MB depending on plan. Multi-gigabyte archives and GeoTIFFs need a chunked upload protocol over the Worker, built and maintained by us, with clients in Node and Python |
| Credentials | R2 keys on each Lambda and the API, scoped by Cloudflare's token permissions | No R2 keys outside the Worker; the Worker can enforce per-project key prefixes and log writes |
| Browser uploads | Presigned PUT to R2, 5 GB per object, progress in the browser as today | A Worker route; the same body limit applies, so large files need the chunked protocol in the browser too |
| Operational risk | A failed upload is a Lambda or SDK error, visible in existing logs | A new service whose availability gates all writes |
| Effort | A config file and a contract test | The Worker, the chunked protocol, three client libraries, migration of every writer |

The deciding factor is the request-body limit. SeaSketch's outputs routinely exceed it, so a write service cannot be a simple proxy; it has to reimplement multipart transfer that the S3 SDKs already provide. The centralized-authorization benefit is real but can be had another way: a small Worker that issues short-lived presigned S3 URLs or scoped tokens to Lambdas on request, which keeps R2 keys out of Lambdas without touching the transfer path. That is orthogonal to local emulation and can be added later without changing this plan.

### Large objects locally

The local S3 API is served by a Worker runtime, so it is fair to ask why the body limit that rules out a write service does not also apply here. The answer is where the limit lives. The 100 MB to 500 MB cap is enforced by Cloudflare's edge, in front of a deployed Worker, before a request reaches the runtime. `wrangler dev` runs the same runtime on the laptop with nothing in front of it; the SDK connects to it directly. There is no edge, so there is no cap, and the 600 MB uploads above confirm it. The limits that do apply locally are R2's own per-call limits, which Miniflare enforces the same way production does: about 5 GB for a single `PutObject`, a 5 MiB minimum part size, and 10,000 parts per multipart upload. Those are the limits the writers already live within in production, so nothing is hidden locally that would surface on deploy.

Miniflare streams object bodies to disk as they arrive and computes the MD5 for the ETag in passing, which is why its memory stayed flat in the test. The one case where it buffers is a request whose `x-amz-content-sha256` header is a literal hash, which it reads fully to verify. The SDKs only send a literal hash for in-memory bodies, so the buffering is bounded by what the writer already held in memory: a style document, a multipart part. Streamed bodies arrive as `UNSIGNED-PAYLOAD` and are not buffered.

A raw upload crosses the local API twice: once from the browser to disk, and once when the spatial-uploads container fetches it with `GetObject` and streams it to its own disk. `GetObject` returns the R2 body stream directly, with range requests honored, so the second crossing is as flat as the first. The cost of the two crossings is throughput, not correctness. The measured rate was about 80 MB/s for the SDK v3 multipart upload and 43 MB/s for `boto3`, on a shared virtual machine; a laptop with a local SSD should do better, and the phase 1 spike records the number.

### Known differences from S3 and R2

| Difference | Effect | Position |
| --- | --- | --- |
| No lifecycle rules | The 24-hour expiry on staged uploads is not emulated. | A cost control, not behavior under test. |
| Experimental configuration key | `local_dev.experimental_s3_credentials` may be renamed by a future `wrangler` release. | One line in `packages/local-r2/wrangler.jsonc`; `wrangler` is pinned. The contract test catches it. |
| Throughput | A multi-gigabyte upload streams through the Worker runtime twice, once on write and once when the processor reads it. No size cap applies locally; see [Large objects locally](#large-objects-locally). | About 80 MB/s measured on a shared VM for a 600 MB multipart upload. The spike records a laptop number. |
| `aws-chunked` request bodies | Miniflare does not unframe the trailing-checksum encoding the AWS SDK v3 sends by default on streamed `PutObject`. | The shared client factory sets `requestChecksumCalculation: "WHEN_REQUIRED"`, which R2 accepts. Covered by the contract test. |
| Several Worker processes on one persistence directory | Cloudflare recommends it. Lock contention under concurrent writes is possible. | A spike item. The fallback is a single multi-config `wrangler dev` session, which guarantees one Miniflare instance but exposes only one Worker over HTTP. |
| Presigned URL path | Presigned URLs point at `localhost:8333/cdn-cgi/local/r2/s3/<bucket>/<key>` rather than at a bucket host. | Nothing parses presigned URLs; the browser only follows them. |

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

The Compose service already exists. The API gains `SUBDIVISION_WORKER_DEV_HANDLER`, with the emulator's invoke URL as its local default, and `preprocessSource` uses it under the same rule as the other handlers. The worker's `R2_PUBLIC_BASE_URL` becomes `UPLOADS_BASE_URL`, set by CDK in production and by Compose locally. It reads the queue endpoint from `SQS_ENDPOINT` and applies the same `STORAGE_ORIGIN_MAP` as the upload container. It reports each output's `publicUrl`, built from `UPLOADS_BASE_URL`.

### Overlay analysis

The host dev server (`tsx watch server.ts`) moves from port 3006, which collides with the data-tables handler, to 3007. It gains the per-origin connection pools, `SQS_ENDPOINT`, and the worker-authentication rule below, and it accepts clipping sources as URLs. `OVERLAY_WORKER_DEV_HANDLER` is filled in by `npm run dev`. Its land and H3 inputs stay on their production public URLs; a developer testing a modified shoreline points those variables at a local upload's URL.

### Data tables

Already a host process on 3006 configured by its own `.env`. Locally its endpoint is the local S3 API and its bucket is `ssn-tiles-local`. The parquet it writes is served by the tiles-host `pmtiles-server` through the `overlay-data-tables` binding, which is the production path. `TAXONOMY_PROXY_URL` is a third-party dependency and stays external.

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
| Storage | `R2_ENDPOINT=http://localhost:8333/cdn-cgi/local/r2/s3`, `R2_TILES_BUCKET=ssn-tiles-local`, `SPATIAL_UPLOADS_BUCKET=ssn-spatial-uploads-tmp-local`, `UPLOADS_BASE_URL=http://localhost:8788`, `TILES_BASE_URL=http://localhost:8787`, the fixed local `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` from `packages/local-r2/wrangler.jsonc` | The production endpoint, bucket names, origins, and real keys | public-config / production-secret |
| Workers under `wrangler dev` | `local-r2` on 8333; `pmtiles-server` on 8787 and 8788 with `UPLOADS_HOST`; sketch preprocessing on 8789; all with `--persist-to .data/wrangler` | Not applicable; production Workers are deployments | public-config |
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
- `scripts/dev.config.mjs` gains `local-r2`, `pmtiles-tiles`, `pmtiles-uploads`, `sketch-preprocessing`, `fragment-worker`, `spatial-uploads-tsc` (the host `tsc -b --watch` that feeds the container), and the moved `overlay-worker`, each with a readiness probe and dependencies: the API waits for `local-r2` and the queue; the Workers wait for the API so they can fetch its JWKS. Host-mode `spatial-uploads` stays as an opt-in entry.
- `npm run dev` runs the core and data profiles. `--profile core` is the opt-out. `--ci` starts the data services once, without watchers. The e2e profile starts the data services on offset ports with `--persist-to .data/wrangler-e2e` and its own queue, so a Playwright run can execute an upload journey beside a developer's own stack.
- `npm run status` lists the new ports and `npm run logs -- <service>` works for every entry.
- The `Dev: stack` VS Code task already runs `npm run dev` and inherits the new default. A `Dev: core only` task is added for the opt-out.
- Host requirements are Docker and Node, as today. No GDAL, tippecanoe, Java, or Python on the host.

## Fidelity

| Difference from production in the default local profile | Why it is acceptable |
| --- | --- |
| Miniflare's R2 instead of R2 | The Workers that read R2 run the same code against the same binding API. |
| Writers reach Miniflare's local S3 API instead of R2's own S3 endpoint | Same SDK calls, same client factory, signatures verified. Only the endpoint differs. The endpoint is Cloudflare's code, written to mirror R2's responses. |
| HTTP and `localhost` ports instead of hostnames | Transport only. The hostname-dependent behavior in `pmtiles-server` is exercised through `UPLOADS_HOST`. |
| Lambda emulator instead of Lambda | Same image, same event, same handler entry point. The emulator does not enforce the 15-minute timeout or the memory limit; Compose's `mem_limit` can approximate the latter. The API awaits the local call rather than firing an asynchronous invoke, which is already how the dev-handler path behaves. |
| ElasticMQ instead of SQS | Same SDK calls. Messages are lost on restart; job state of record is Postgres. |
| No Cloudflare edge cache in front of `pmtiles-server` | Cache behavior is not under test locally. |
| Workers send no access token | Matches `pmtiles-server` with access control off, which is production's current setting. |
| Overlay, fragment, and data-table processors as host Node processes rather than Lambda containers | Pure Node code with no native toolchain; already the dev pattern for two of the three. They can be containerized with the same emulator recipe if a discrepancy ever appears. |

## Phase 0 verification

**0a.** On production, after deploy: upload a shapefile, a GeoJSON, a GeoTIFF, a FlatGeobuf, and a data table; upload a file larger than 1 GB and watch the progress bar; cancel an upload partway through; replace a PMTiles archive; confirm from handler logs that the staged file was read from R2; confirm the lifecycle rule deletes objects and aborts incomplete multipart uploads after 24 hours. The production probe gains a read-only check that `presignedUploadUrl` returns an R2 host. Rollback is the previous bucket name and client in the environment. The cutover is a hard switch: the processor looks only in the bucket its environment names, and an upload already sitting in S3 whose job has not finished will fail until it is uploaded again. The S3 bucket stays, empty, until its expiration has drained it, and is removed by a later infrastructure change. `DataUploadsNormalized`, which appears only in infrastructure configuration and not in handler code, is confirmed unused and removed.

**0b.** On production, after deploy: the full upload, data-table, geography, sketch, and report flows; a layer deletion with its cleanup confirmed in R2; the production probe green; a query confirming every `overlay_data_tables.parquet_url` resolves. Rollback is the previous API image; the added column is inert to it.

### Phase 0b deploy order

The production workflow already runs migrations, then the API, then the client, and it refuses to publish the client until the live schema accepts the client's operations. The workers and Lambdas are not in that workflow. Deploy them first. In-flight jobs may fail during the window; a few minutes of downtime is accepted. A browser that has not reloaded keeps working.

1. **Workers and Lambdas, before the workflow.** Each of these accepts what production sends today and what the new API sends. Order among them does not matter.
   - `SpatialUploadHandler` and `DataTablesHandler`. The owned-bucket check has to be in place before a cleanup or a handler write runs on the new API.
   - `SeaSketchOverlayWorker` and `SeaSketchFragmentWorker`. The new API passes a URL as `source`. The workers in production today do not. The new workers still accept a bare key, so they keep working until the API deploy.
   - `SeaSketchSubdivisionWorker`. This deploy sets `UPLOADS_BASE_URL` and drops `R2_PUBLIC_BASE_URL`. The handler builds `publicUrl` from `UPLOADS_BASE_URL`. The API stores that field and rejects a result without it. The Lambda in production already sends `publicUrl`, so an API deploy against it would also succeed; shipping the Lambda first is what renames the variable.
   - The sketch-preprocessing Worker (`wrangler deploy` from `packages/sketch-preprocessing-worker`). The new client sends `fgbUrl` as the clipping dataset. The Worker in production treats that string as an object key. The new Worker accepts a URL, and it still accepts a bare key, which is what a stale browser sends (the key it stripped from `objectKey`) and what `vectorObjectKey` still is.

2. **The production workflow.** Migrations, then the API, then the client.
   - The migration adds `parquet_url` and makes the clipping functions return `fgb_url`. The new API reads those names, so the migration has to be applied first. The workflow already does this.
   - The API exposes `fgbUrl` and still exposes deprecated `objectKey` with the same remote as before. `JobStatusUpdater` requires `publicUrl`.
   - The client goes last. It queries `fgbUrl`, so the API must already be serving that field, and it sends that URL to sketch preprocessing, so that Worker must already accept a URL. Browsers that have not reloaded keep querying `objectKey`.

`pmtiles-server` is unchanged in this phase.

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

## Decisions

Accepted October 2026. None has shipped yet; a decision gets a second month when it does, and anything implementation overturns is corrected in place.

- Rows that reference objects are self-contained: a complete `url` and a bucket-qualified `remote`, with `overlay_data_tables.parquet_url` added to complete the set. There is no registry table. Code reads stored URLs and never reconstructs them. Hostnames written into data-path code are removed, which narrows the "hostnames are later debt" stance in [second install](second-install.md) to the hostnames this plan does not touch.
- A process may write, delete, or inspect only buckets named in its own environment. Every other remote is read-only by URL. Nothing about storage authorization lives in the database or in request payloads. Bucket names are unique across every store a database can refer to.
- Raw uploads move from the `DataUploads` S3 bucket to the R2 bucket `ssn-spatial-uploads-tmp`, reached by presigned PUT through R2's S3 API. The existing account-wide R2 token is reused. Objects and incomplete multipart uploads expire after 24 hours. Phase 0 is implemented and tested locally against that bucket before the production environment is switched. The switch is a hard cut of bucket name and client, with no dual-read of the old S3 bucket. No Worker in the upload path. The local counterpart, used from phase 1, is `ssn-spatial-uploads-tmp-local`.
- Spatial uploads, subdivision, overlay analysis, and fragment creation stay on Lambda with SQS. Cloudflare is used for storage and serving.
- Local object storage is Miniflare's R2, shared across `wrangler dev` sessions through one persistence directory under `.data/`, with local bucket names. Writers reach it through `wrangler dev`'s built-in S3-compatible API, served from a config-only `packages/local-r2` project. SeaSketch owns no S3 translation code. There is no S3-compatible storage container and no R2 shim in production Workers. A production write-service Worker was considered and set aside because of the Workers request-body limit; see [Why the S3 protocol](#why-the-s3-protocol-and-the-alternatives).
- The shared S3 client factory sets `requestChecksumCalculation: "WHEN_REQUIRED"` in every environment. R2 accepts it; Miniflare's S3 API requires it for streamed `PutObject`.
- The spatial-uploads handler's default local form is the production container under the Lambda emulator, built from a prebuilt runtime image that production also uses. Host mode is an opt-in.
- `pmtiles-server` runs as two sessions covering the tiles and uploads hosts.
- The results queue is ElasticMQ locally. AWS credentials leave the default profile.
- Workers follow the API's rule for the overlay-engine token: no secret ARN outside production means no header.
- `SUBDIVISION_WORKER_DEV_HANDLER` and `FRAGMENT_WORKER_DEV_HANDLER` join the dev-handler pattern; the fragment worker gets a local server; the overlay worker moves to port 3007.
- The client gets one new variable, `REACT_APP_SKETCH_PREPROCESSING_URL`.
- `npm run dev` starts the data path by default and `--profile core` opts out.
- The golden snapshot carries no objects. Fixtures keep their production URLs. Local objects are created through the pipeline.

## Open questions

- *(Phase 0b, decided)* Deploy order is [Phase 0b deploy order](#phase-0b-deploy-order). Workers and Lambdas first, then the production workflow (migrations, API, client). `JobStatusUpdater` stores `publicUrl` and rejects a result without it. `objectKey` stays for a stale browser. In-flight jobs are not given a compatibility window.
- *(Phase 1)* The remainder of the Miniflare spike. Already shown on a shared VM: each writer's real SDK calls succeed against the local S3 API, a presigned PUT works as the browser sends it, a 600 MB multipart upload completes with `workerd` memory flat, and a second session reads what the first wrote. Still to show, on a laptop: a 3 GB raw upload by presigned PUT, concurrent writes and `pmtiles-server` reads with no SQLite lock errors across ten consecutive uploads, and the throughput number.
- *(Phase 1)* Whether `preview_bucket_name` or an `[env.local]` block is the right way to give the Workers local bucket names under `wrangler dev` without touching their production configuration.
- *(Phase 1)* Whether the prebuilt runtime image is pinned by digest in the Dockerfile or tracked as `latest`.
- *(Phase 1)* Whether to file the `aws-chunked` unframing request against Miniflare, and whether to keep `WHEN_REQUIRED` if it lands.
- *(Phase 2)* Whether a local mode with tile access control enabled is built in this phase or deferred until the multi-level admin journeys need it.
- *(Phase 2)* Whether the overlay, fragment, and data-table processors should also get container forms under the Lambda emulator for closer parity. The default position is that host Node processes are sufficient until a discrepancy is observed.

## Exit criteria

- **Phase 0:** Raw uploads land in R2 on production. No data-path code holds a storage hostname or reconstructs a URL from a key. `parquet_url` is populated for every data table. The production probe is green after each deploy.
- **Phase 1:** A clean machine with Docker, Node, and a `.env` containing a Mapbox token runs `setup` then `dev`, uploads a layer, and renders it from local storage beside production-hosted fixture layers. The layer survives `dev` restarts and is removed by `setup --reset`. CI runs the upload journey without cloud credentials.
- **Phase 2:** The same machine builds a geography from a local layer and a production EEZ, clips a sketch, creates its fragments, and renders a report with overlay metrics, with every SeaSketch process local. CI runs the data-table, report-card, and sketch-clipping journeys without cloud credentials. The data-profile exit criterion in [local services](local-services.md) is met and marked.
- **Throughout:** For each processor, the variable that points at production is documented beside its local default, and the CI configuration check rejects it. No pull request adds a storage hostname to the data path or reconstructs a URL from a key.

## Glossary

- **R2** is Cloudflare's object store. A Worker reaches it through a binding; anything else reaches it through its S3-compatible API.
- **Miniflare** is the simulator `wrangler dev` runs Workers in. It provides local R2 buckets backed by files, reachable through bindings and, since July 2026, through an S3-compatible API when a bucket is configured with local credentials.
- **Lambda emulator** is the AWS Lambda Runtime Interface Emulator, a small server inside AWS's Lambda base images that accepts an invocation over HTTP (`POST /2015-03-31/functions/function/invocations`) and delivers it to the handler as Lambda would.
- **GitHub Container Registry** (`ghcr.io`) is an image registry attached to the GitHub organization that GitHub Actions can push to with its default token.
- **ElasticMQ** is an SQS-compatible queue server that runs as one container with no credentials.
- **Remote** is SeaSketch's existing bucket-qualified object reference, `r2://<bucket>/<key>` or `s3://<bucket>/<key>`.

## Effect on the other topic files

Applied on acceptance, October 2026: [local services](local-services.md) moved its phase 3 open questions (an emulator over per-developer AWS queues; local R2 under Miniflare over fixture archives; a prebuilt runtime image for CI build time) and its phase 5 question (fragment and subdivision get local entry points here) into its decisions, and its *Profiles* section records that the data profile becomes the `npm run dev` default. [Second install](second-install.md) points the data-path items in its known-debt paragraph at the storage model. [Strategy](strategy.md) phase 3 names the phase 0 production groundwork as a prerequisite.

Still to apply as work lands: [Service inventory](service-inventory.md) is updated row by row as each stand-in ships. [Secrets](secrets-management.md) gains the new manifest entries with phase 1. The repo `README.md` and the package READMEs receive the operating instructions; this file does not.
