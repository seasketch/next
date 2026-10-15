#!/bin/bash

echo "Building API with TypeScript project references..."
cd packages/api
npm run build

echo "Build complete! You can now run:"
echo "  npm run build:watch  # for watch mode, from packages/api"
echo "  npm start            # to start this package's server"
echo "  npm run dev          # the running stack, from the repo root" 