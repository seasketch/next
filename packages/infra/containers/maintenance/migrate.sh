#!/bin/bash
git fetch --all
git checkout --force master
npm run db:migrate
echo "database migrations complete"