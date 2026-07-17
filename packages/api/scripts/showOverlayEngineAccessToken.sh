#!/usr/bin/env bash
# Print the current overlay-engine token JSON from Secrets Manager.
# Bastion-friendly: needs aws CLI + task-role read on the secret (no npm deps).
set -euo pipefail

SECRET_ID="${OVERLAY_ENGINE_ACCESS_TOKEN_SECRET_ARN:-seasketch/overlay-engine/access-token}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found." >&2
  exit 1
fi

raw="$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --query SecretString \
  --output text)"

if command -v jq >/dev/null 2>&1; then
  echo "$raw" | jq .
else
  echo "$raw"
fi
