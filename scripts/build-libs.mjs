#!/usr/bin/env node
// Build workspace libraries whose package entry points are compiler output.
// Order is the dependency order. npm has no task runner here (no Lerna, Nx,
// or Turborepo); `tsc -b` alone skips tsup, rollup, and esbuild steps.
import { spawnSync } from "node:child_process";

const order = [
  "@seasketch/geostats-types",
  "fgb-source",
  "@seasketch/h3-land",
  "@seasketch/raster-array",
  "ai-data-analyst",
  "@seasketch/metadata-parser",
  "gl-style-builder",
  "@seasketch/vector-data-source",
  "@seasketch/map-tile-cache-calculator",
  "@seasketch/mapbox-gl-esri-sources",
  "overlay-engine",
  "overlay-worker",
  "@seasketch/lambda-db-client",
];

for (const name of order) {
  console.log(`\n# build ${name}`);
  const result = spawnSync(
    "npm",
    ["run", "build", "--workspace", name, "--silent"],
    { stdio: "inherit" }
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
