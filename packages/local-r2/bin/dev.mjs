#!/usr/bin/env node
// Start wrangler dev for the local buckets.
//
//   LOCAL_R2_PORT        default 8333
//   LOCAL_R2_PERSIST_TO  default <repo>/.data/wrangler
//   LOCAL_R2_IP          default 0.0.0.0 so containers can reach it
//
// Every local Worker session that should see the same objects passes the same
// --persist-to directory. The e2e profile points this at .data/wrangler-e2e.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  defaultPersistDir,
  defaultPort,
  envValues,
  packageDir,
  repoRoot,
  wranglerBin,
} from "../config.mjs";

const port = Number(process.env.LOCAL_R2_PORT || defaultPort);
const persistTo = path.resolve(
  repoRoot,
  process.env.LOCAL_R2_PERSIST_TO || defaultPersistDir
);
const ip = process.env.LOCAL_R2_IP || "0.0.0.0";

mkdirSync(persistTo, { recursive: true });

const args = [
  wranglerBin,
  "dev",
  "--ip",
  ip,
  "--port",
  String(port),
  "--persist-to",
  persistTo,
  "--no-show-interactive-dev-session",
];

console.log(`local-r2: S3 API at ${envValues(port).R2_ENDPOINT}`);
console.log(`local-r2: objects persist in ${path.relative(repoRoot, persistTo)}`);
console.log("local-r2: values for a .env that uses this storage:");
for (const [name, value] of Object.entries(envValues(port))) {
  console.log(`  ${name}=${value}`);
}

const child = spawn(process.execPath, args, {
  cwd: packageDir,
  stdio: "inherit",
  env: {
    ...process.env,
    // Keep wrangler's update check and telemetry prompts out of the log.
    WRANGLER_SEND_METRICS: "false",
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}

child.on("exit", (code, signal) => {
  process.exit(code === null ? (signal ? 1 : 0) : code);
});
