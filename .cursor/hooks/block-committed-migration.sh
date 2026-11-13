#!/usr/bin/env bash
# Cursor hook. Always prints a permission JSON object and exits 0.
# Missing node fails open so a laptop is not locked out of the terminal.
# hooks.json sets failClosed, which still blocks the matched command if this
# script is missing or does not print JSON.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '{"continue":true,"permission":"allow"}'
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
input="$(cat)"
if ! decision="$(printf '%s' "$input" | node "$ROOT/scripts/migration-commit-guard.mjs" hook)"; then
  printf '%s\n' '{"continue":true,"permission":"allow"}'
  exit 0
fi
printf '%s\n' "$decision"
