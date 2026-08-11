#!/usr/bin/env bash
# One-off fixture generator (not part of CI).
# Requires a Python with rasterio, numpy, shapely, pyproj (e.g. the rio-cogeo pipx venv).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PY="${RASTERIO_PYTHON:-/Users/cburt/.local/pipx/venvs/rio-cogeo/bin/python}"
exec "$PY" "$ROOT/packages/overlay-engine/scripts/generate-raster-overlay-area-fixtures.py" "$@"
