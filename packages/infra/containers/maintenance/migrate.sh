#!/usr/bin/env bash
git fetch --all
git checkout --force $1
npm run db:migrate
echo "database migrations complete" 