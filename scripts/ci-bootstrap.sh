#!/usr/bin/env bash
# Install one CI job's packages.
#
# `lerna bootstrap --ci --scope` drops npm ci and runs npm install, which
# re-resolves the tree. Actions already restores the npm download cache, and
# that only helps a lockfile install. --force-local keeps npm ci and links
# sibling packages instead of fetching them.
#
# Local `npm run bootstrap` is unchanged.
set -euo pipefail

cd "$(dirname "$0")/.."

export npm_config_audit=false
export npm_config_fund=false
export npm_config_prefer_offline=true
export npm_config_update_notifier=false

echo "root npm ci"
npm ci
echo "lerna bootstrap $*"
npx --no-install lerna bootstrap --ci --force-local "$@"
echo "bootstrap done"
