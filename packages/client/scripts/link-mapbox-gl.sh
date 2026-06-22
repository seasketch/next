#!/usr/bin/env bash
# Keep a single mapbox-gl type/runtime instance across monorepo packages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLIENT="$ROOT/client"
WMS="$ROOT/mapbox-gl-wms-source"
ESRI="$ROOT/mapbox-gl-esri-sources"

link_mapbox() {
  local pkg_dir="$1"
  mkdir -p "$pkg_dir/node_modules/@types"
  ln -sfn ../../client/node_modules/mapbox-gl "$pkg_dir/node_modules/mapbox-gl"
  ln -sfn ../../../client/node_modules/@types/mapbox-gl "$pkg_dir/node_modules/@types/mapbox-gl"
}

if [[ -d "$CLIENT/node_modules/mapbox-gl" ]]; then
  link_mapbox "$WMS"
  link_mapbox "$ESRI"
fi
