#!/usr/bin/env node
// Local sketch-preprocessing Worker. Shares the local-r2 persistence
// directory so a layer uploaded on this machine is read through the R2
// binding. Public fixture URLs (production EEZ and land) are fetched over
// HTTP by the Worker itself.
//
//   SKETCH_PREPROCESSING_PORT  default 8789
//   LOCAL_R2_PERSIST_TO        default <repo>/.data/wrangler
//   UPLOADS_HOST               hosts whose objects live in the local bucket
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultPersistDir, repoRoot, wranglerBin } from "../../local-r2/config.mjs";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.SKETCH_PREPROCESSING_PORT || 8789);
const persistTo = path.resolve(
  repoRoot,
  process.env.LOCAL_R2_PERSIST_TO || defaultPersistDir
);
const uploadsHost =
  process.env.UPLOADS_HOST ||
  `localhost:${process.env.PMTILES_UPLOADS_PORT || 8788},127.0.0.1:${process.env.PMTILES_UPLOADS_PORT || 8788}`;
mkdirSync(persistTo, { recursive: true });

const args = [
  wranglerBin,
  "dev",
  "--ip",
  "0.0.0.0",
  "--port",
  String(port),
  "--persist-to",
  persistTo,
  "--inspector-port",
  "0",
  "--no-show-interactive-dev-session",
  "--var",
  `UPLOADS_HOST:${uploadsHost}`,
];

console.log(`sketch-preprocessing: http://localhost:${port}`);
console.log(
  `sketch-preprocessing: objects from ${path.relative(repoRoot, persistTo)}`
);

const child = spawn(process.execPath, args, {
  cwd: packageDir,
  stdio: "inherit",
  env: {
    ...process.env,
    UPLOADS_HOST: uploadsHost,
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
