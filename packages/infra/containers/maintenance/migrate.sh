#!/usr/bin/env bash
set -euo pipefail

cd /usr/src/app/next
git fetch --all --prune
git checkout --force "$1"
cd packages/api
graphile-migrate migrate
echo "database migrations complete"