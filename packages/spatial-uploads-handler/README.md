# `spatial-uploads-handler`

Lambda-based worker for processing user uploads of spatial data in SeaSketch. Converts data into FlatGeobuf, GeoJSON, MVT, and COGs as appropriate depending on file format and size. Heavily relies on PMTiles to create compact tilesets that are easy and cheap to host.

## Arch

This system relies on Lambda's support for containerized functions using a `Dockerfile` so that tippecanoe, gdal, and pmtiles can be included in the runtime environment. Deployment of this lambda is handled in the `infra/` package (UploadHandlerLambdaStack).

Users create an upload record in the DB which gives them access to a presignedUploadUrl to upload their data to S3 (bucket defined by `SPATIAL_UPLOADS_BUCKET` api env var). After submitting this upload for processing via the GraphQL API, a graphile-worker job requests processing by this lambda.

## API Server Setup

When running the API server, you can choose to invoke the production lambda to process uploads by setting `SPATIAL_UPLOADS_LAMBDA_ARN`. CDK automatically sets this in production. On a development setup, this same handler can be used, or Docker can be used to process uploads locally by setting `SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER`. To run the development server, you will need to build and run the container defined by the Dockerfile like so:

```sh
# Create a .env file, filling in details defined in process-env.d.ts
touch .env
docker build -t spatial-uploads-handler .
docker run -p 9000:8080 --env-file .env spatial-uploads-handler:latest
# update .env of packages/api to set
# SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER=http://localhost:9000/2015-03-31/functions/function/invocations
```

## Creating a new deployment

If updates are needed to the handler code or container environment, test using the dev setup and then run `npx cdk deploy -e SpatialUploadHandler`
