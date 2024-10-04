#!/usr/bin/env bash
git fetch --all
git checkout --force $1
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:migrate
echo "database migrations complete" 