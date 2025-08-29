#!/bin/bash
set -e

# Source environment variables
source ../api/.env
source ./.env

export AWS_PROFILE=sls

# Export specific environment variables needed by CDK
export AUTH0_CLIENT_ID
export AUTH0_CLIENT_SECRET
export AUTH0_DOMAIN
export UNSPLASH_KEY
export SENTRY_DSN
export MAPBOX_ACCESS_TOKEN
export COMMIT
export SCREENSHOTTER_FUNCTION_ARN
export R2_ENDPOINT
export R2_SECRET_ACCESS_KEY
export R2_ACCESS_KEY_ID
export R2_FILE_UPLOADS_BUCKET
export R2_TILES_BUCKET
export CLOUDFLARE_IMAGES_TOKEN
export CLOUDFLARE_IMAGES_ACCOUNT
export CLOUDFLARE_IMAGES_ACCOUNT_HASH
export CLOUDFLARE_ACCOUNT_TAG
export CLOUDFLARE_GRAPHQL_TOKEN
export CLOUDFLARE_SITE_TAG
export PMTILES_SERVER_ZONE
export GOOGLE_MAPS_2D_TILE_API_KEY


# Run CDK synth
cdk synth
