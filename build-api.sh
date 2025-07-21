#!/bin/bash

echo "Building API with TypeScript project references..."
cd packages/api
npm run build

echo "Build complete! You can now run:"
echo "  npm run build:watch  # for watch mode"
echo "  npm start            # to start the server" 