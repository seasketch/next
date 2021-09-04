#!/bin/sh
export $(node ../infra/lib/getClientBucket.js)
if [[ -z "$S3_BUCKET" ]]; then
    echo "S3_BUCKET could not be found" 1>&2
    exit 1
fi

echo "Uploading files to $S3_BUCKET..."
aws s3 sync build $S3_BUCKET \
  --acl public-read \
  --cache-control max-age=31536000 \
  --exclude service-worker.js \
  --exclude manifest.json \
  --exclude index.html \
  --delete

echo "Uploading manifest.json"
aws s3 cp build/manifest.json $S3_BUCKET/manifest.json \
  --metadata-directive REPLACE \
  --cache-control max-age=0,no-cache,no-store,must-revalidate \
  --content-type application/json \
  --acl public-read

echo "Uploading index.html"
aws s3 cp build/index.html $S3_BUCKET/index.html \
  --metadata-directive REPLACE \
  --cache-control max-age=0,no-cache,no-store,must-revalidate \
  --content-type text/html \
  --acl public-read
