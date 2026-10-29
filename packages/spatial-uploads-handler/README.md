# `spatial-uploads-handler`

Lambda-based worker for processing user uploads of spatial data in SeaSketch. Converts data into FlatGeobuf, GeoJSON, MVT, and COGs as appropriate depending on file format and size. Heavily relies on PMTiles to create compact tilesets that are easy and cheap to host.

For **single-band continuous/categorical rasters**, scalar values are packed into RGB channels before tiling. See **[RGB_ENCODING.md](./RGB_ENCODING.md)** for the full encoding scheme, how `base` / `interval` / `byteEncoding` are chosen, Mapbox `raster-color-mix` integration, and client interactivity decoding.

## Arch

This system relies on Lambda's support for containerized functions using a `Dockerfile` so that tippecanoe, gdal, and pmtiles can be included in the runtime environment. Deployment of this lambda is handled in the `infra/` package (UploadHandlerLambdaStack).

Users create an upload record in the DB which gives them access to a presignedUploadUrl to upload their data to S3 (bucket defined by `SPATIAL_UPLOADS_BUCKET` api env var). After submitting this upload for processing via the GraphQL API, a graphile-worker job requests processing by this lambda.

## Running locally

`npm run dev` at the repository root starts this handler as the production image under the Lambda runtime emulator, as the Compose service `spatial-uploads` on port 9001, and points the API at it (`SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER=http://localhost:9001/2015-03-31/functions/function/invocations`). It writes to the local object storage described in [packages/local-r2](../local-r2/README.md) and the rows it creates carry `http://localhost:8787` and `8788` URLs. Nothing in this package needs a `.env` for that; `compose.yaml` holds the local values.

Edit the TypeScript and the `spatial-uploads-tsc` watcher rebuilds `dist/`; Compose Watch copies it into the container and restarts it. A change to `package.json` or the Dockerfile needs an image rebuild, which `npm run dev` does on its next start.

### The two images

`Dockerfile.runtime` is the slow part: GDAL and its libraries, tippecanoe, go-pmtiles, rclone, unrar, and the Python raster libraries on the Lambda Node base. It is published to `ghcr.io/seasketch/spatial-uploads-runtime:<tag>` by the *Spatial uploads runtime image* workflow when that file changes on `master` or by hand (`workflow_dispatch`). The tag is the content hash of the file (`npm run runtime-image` prints it), so a tag is published once and never changes. `Dockerfile` pins the tag it needs; `npm run runtime-image:pin` rewrites the pin after a runtime change and CI fails on a stale pin.

`Dockerfile` builds the workspace on the Lambda base and copies it onto the runtime image. It is what Compose builds locally, what `scripts/build-images.mjs` builds, and what CDK deploys. To build the runtime image yourself instead of pulling it, `npm run runtime-image:build` (tens of minutes).

### Against the deployed handler

Set `SPATIAL_UPLOADS_LAMBDA_ARN` in `packages/api/.env`, together with the production `R2_ENDPOINT`, bucket names, and keys, and `npm run dev` leaves the local container out. The staged upload has to be where the deployed handler can read it, which is why the storage values go with it. CI rejects those values.

### Host mode

`npm run dev -- --only spatial-uploads-host` runs `tsx watch server.ts` on port 3005 for someone iterating on the handler with GDAL, tippecanoe, and go-pmtiles installed on the host. It is not started by default and not used in CI.

## Creating a new deployment

If updates are needed to the handler code or container environment, test using the dev setup and then run `npx cdk deploy -e SpatialUploadHandler`
