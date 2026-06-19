#!/usr/bin/env bash
# Mirrors the GitHub Actions WMS job (unit-tests.yml → test-mapbox-gl-wms-source)
# without re-running root lerna bootstrap. Run from repo root or package dir.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${VITE_MAPBOX_TOKEN:-}" ]]; then
  echo "error: VITE_MAPBOX_TOKEN is not set." >&2
  echo "  cp .env.example .env  # then add your pk.* token from packages/client/.env" >&2
  exit 1
fi

echo "→ build metadata-parser"
npm run build --prefix ../metadata-parser

echo "→ build WMS package"
npm run build

echo "→ unit tests"
npm test

echo "→ E2E tests (CI mode — no .env required if VITE_MAPBOX_TOKEN is exported)"
CI=true VITE_MAPBOX_TOKEN="$VITE_MAPBOX_TOKEN" npm run test:e2e

echo "✓ verify:ci passed"
