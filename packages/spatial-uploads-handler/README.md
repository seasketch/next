# `spatial-uploads-handler`

Lambda-based worker for processing user uploads of spatial data in SeaSketch. Converts data into FlatGeobuf, GeoJSON, MVT, and COGs as appropriate depending on file format and size. Heavily relies on PMTiles to create compact tilesets that are easy and cheap to host.

For **single-band continuous/categorical rasters**, scalar values are packed into RGB channels before tiling. See **[RGB_ENCODING.md](./RGB_ENCODING.md)** for the full encoding scheme, how `base` / `interval` / `byteEncoding` are chosen, Mapbox `raster-color-mix` integration, and client interactivity decoding.

## Arch

This system relies on Lambda's support for containerized functions using a `Dockerfile` so that tippecanoe, gdal, and pmtiles can be included in the runtime environment. Deployment of this lambda is handled in the `infra/` package (UploadHandlerLambdaStack).

Users create an upload record in the DB which gives them access to a presignedUploadUrl to upload their data to S3 (bucket defined by `SPATIAL_UPLOADS_BUCKET` api env var). After submitting this upload for processing via the GraphQL API, a graphile-worker job requests processing by this lambda.

## Running locally

`npm run dev` at the repository root starts this handler as the production image under the Lambda runtime emulator, as the Compose service `spatial-uploads` on port 9001, and points the API at it (`SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER=http://localhost:9001/2015-03-31/functions/function/invocations`). It writes to the local object storage described in [packages/local-r2](../local-r2/README.md) and the rows it creates carry `http://localhost:8787` and `8788` URLs. Nothing in this package needs a `.env` for that; `compose.yaml` holds the local values.

Edit the TypeScript and the `spatial-uploads-tsc` watcher rebuilds `dist/`; Compose Watch copies it into the container and restarts it. A change to `package.json` or the Dockerfile needs an image rebuild, which `npm run dev` does on its next start.

### The image and its cache

`Dockerfile` has two parts. The `tools`, `gdal`, and `runtime` stages are the slow part: GDAL and its libraries, tippecanoe, go-pmtiles, rclone, unrar, and the Python raster libraries on the Lambda Node base, tens of minutes to compile. The `builder` stage and the final stage are the application: the workspace compiled on the Lambda base and copied onto `runtime`, seconds. Compose builds this file locally, `scripts/build-images.mjs` builds it, and CDK deploys it.

Nobody should have to compile GDAL on their own machine to use it. The *Spatial uploads runtime cache* workflow builds the slow stages on Actions and exports every layer as a BuildKit registry cache, `ghcr.io/seasketch/spatial-uploads-runtime:cache` from `master` and `:cache-<branch>` from a branch, when the Dockerfile changes or by hand. Every builder passes the master ref as `--cache-from` (`cache_from` in `compose.yaml`, `cacheFrom` in `UploadHandlerLambdaStack`, the flag in `build-images.mjs`), so the usual build pulls about 1.8 GB of finished layers once and reuses them from then on. The cache is a hint, not a dependency: a checkout that changes one of the slow stages builds what changed and reuses the rest, and a registry that cannot be reached means a slow build, not a failed one. That keeps the hot-patch path simple: edit, build, deploy, from any branch, pushed or not.

Two things keep the cache stable. The base image is pinned by digest, because BuildKit keys a stage on the base it resolved and a floating tag would silently invalidate everything the day AWS republished it; bump the digest deliberately. And the slow stages come first in the file, before anything that copies source, so an application change cannot disturb them. Registry cache import needs BuildKit, which Docker Desktop has; on Linux install `docker-buildx`.

### The AI Cartographer locally

With the AI Cartographer on, the handler asks the Cloudflare AI Gateway (`CF_AIG_URL`, `CF_AIG_TOKEN`) for a title, an attribution, and column intelligence, and before column intelligence it sends the geostats to the PII classifier Lambda (`GEOSTATS_PII_CLASSIFIER_ARN`). `npm run dev` hands the container the gateway values from this package's `.env` (then the API's). The classifier is a deployed Lambda, and the Cartographer does not run without it: with the ARN unset, an upload that asks for the Cartographer fails before the first prompt with a message naming the variable, so nothing from the file reaches the model unscreened. An upload with the Cartographer off still succeeds, stored unassessed. To run the Cartographer locally, point `GEOSTATS_PII_CLASSIFIER_ENDPOINT` at a Lambda emulator running the classifier image (or the e2e mock, below) and set the ARN to `function`.

The e2e profile has no gateway token and no classifier. It points both variables at `packages/e2e/bin/ai-cartographer-mock.mjs`, a small HTTP server that answers the three prompts with fixed, schema-valid JSON and marks geostats as assessed, so `tests/uploads.spec.ts` can run one upload with the Cartographer enabled and one with it declined. Nothing from a Playwright run reaches the real gateway, whatever the developer's `.env` holds.

### Against the deployed handler

Set `SPATIAL_UPLOADS_LAMBDA_ARN` in `packages/api/.env`, together with the production `R2_ENDPOINT`, bucket names, and keys, and `npm run dev` leaves the local container out. The staged upload has to be where the deployed handler can read it, which is why the storage values go with it. CI rejects those values.

### Host mode

`npm run dev -- --only spatial-uploads-host` runs `tsx watch server.ts` on port 3005 for someone iterating on the handler with GDAL, tippecanoe, and go-pmtiles installed on the host. It is not started by default and not used in CI.

## Creating a new deployment

If updates are needed to the handler code or container environment, test using the dev setup and then run `npx cdk deploy -e SpatialUploadHandler`

The handler fetches staged uploads from `BUCKET`, which CDK sets from `SPATIAL_UPLOADS_BUCKET` in `packages/infra/.env`. The API (deployed by CI) presigns uploads into the same variable. Before synthesizing, the CDK app compares your `SPATIAL_UPLOADS_BUCKET` with the values currently deployed on `SeaSketchGraphQLServer` and `SpatialUploadHandler` and refuses to continue on a mismatch, since a mismatch leaves every upload stuck at "fetching". Set `SKIP_SPATIAL_UPLOADS_BUCKET_CHECK=1` only when intentionally moving both stacks to a new bucket.
