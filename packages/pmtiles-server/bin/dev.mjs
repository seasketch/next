#!/usr/bin/env node
// Start wrangler dev for one of the two roles this Worker plays.
//
//   node bin/dev.mjs tiles     the tiles host (TileJSON, tiles, downloads), 8787
//   node bin/dev.mjs uploads   the uploads host (every key is an opaque object), 8788
//
// The tiles session also loads wrangler.data-tables.toml so its DATA_TABLES
// service binding resolves. The uploads session loads only wrangler.toml:
// data-table queries are a tiles-host feature, and one registration of
// overlay-data-tables in the dev registry is enough. Both sessions read the
// bucket packages/local-r2 writes through the same --persist-to directory.
// Overrides:
//
//   PMTILES_DEV_PORT     default 8787 (tiles) or 8788 (uploads)
//   LOCAL_R2_PERSIST_TO  default <repo>/.data/wrangler, shared with local-r2
//   PMTILES_DEV_IP       default 0.0.0.0 so containers can reach it
//   JWKS_URL             default the local API's JWKS
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultPersistDir,
  repoRoot,
  wranglerBin,
} from "../../local-r2/config.mjs";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const role = process.argv[2];
const ports = { tiles: 8787, uploads: 8788 };
if (!(role in ports)) {
  console.error("usage: dev.mjs tiles|uploads");
  process.exit(1);
}

const port = Number(process.env.PMTILES_DEV_PORT || ports[role]);
const ip = process.env.PMTILES_DEV_IP || "0.0.0.0";
const persistTo = path.resolve(
  repoRoot,
  process.env.LOCAL_R2_PERSIST_TO || defaultPersistDir
);
const jwksUrl =
  process.env.JWKS_URL || "http://127.0.0.1:3857/.well-known/jwks.json";
mkdirSync(persistTo, { recursive: true });

const vars = {
  JWKS_URL: jwksUrl,
  // TileJSON tile URLs point back at this session.
  PUBLIC_HOSTNAME: `http://localhost:${port}`,
};
if (role === "uploads") {
  vars.UPLOADS_HOST = `localhost:${port},127.0.0.1:${port},host.docker.internal:${port}`;
}

const configs = ["wrangler.toml"];
if (role === "tiles") {
  configs.push("wrangler.data-tables.toml");
}

const args = [
  wranglerBin,
  "dev",
  ...configs.flatMap((config) => ["-c", config]),
  "--ip",
  ip,
  "--port",
  String(port),
  "--persist-to",
  persistTo,
  // OS-assigned inspector port. Concurrent sessions otherwise race for 9229+.
  "--inspector-port",
  "0",
  "--no-show-interactive-dev-session",
];
for (const [name, value] of Object.entries(vars)) {
  args.push("--var", `${name}:${value}`);
}

console.log(`pmtiles-server (${role}): http://localhost:${port}`);
console.log(`pmtiles-server (${role}): objects from ${path.relative(repoRoot, persistTo)}`);

const child = spawn(process.execPath, args, {
  cwd: packageDir,
  stdio: "inherit",
  env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
child.on("exit", (code, signal) => {
  process.exit(code === null ? (signal ? 1 : 0) : code);
});
