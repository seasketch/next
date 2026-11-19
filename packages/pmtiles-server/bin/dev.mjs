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
const ports = { tiles: 8787, uploads: 8788 };

// Retries a child that exits because the shared persistence files are locked.
// A clean exit, a signal, or any other failure is returned as-is.
export async function launchUntilUnlocked({
  spawnChild,
  attempts,
  pauseMs,
  shouldStop,
  onRetry,
}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const outcome = await spawnChild();
    if (shouldStop() || !outcome.locked || attempt === attempts) {
      return outcome;
    }
    onRetry(attempt);
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  await startSession(process.argv[2]);
}

async function startSession(role) {
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
  console.log(
    `pmtiles-server (${role}): objects from ${path.relative(repoRoot, persistTo)}`
  );

  // startAfter waits until the previous session accepts TCP. That session can
  // still be opening the shared SQLite files (one per bucket, including the
  // file-uploads bucket), and this process then exits with SQLITE_BUSY. Retry
  // that open; any other exit is final.
  const attempts = 4;
  const pauseMs = 1500;
  let child;
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      stopping = true;
      if (child && !child.killed) child.kill(signal);
    });
  }

  const outcome = await launchUntilUnlocked({
    attempts,
    pauseMs,
    shouldStop: () => stopping,
    onRetry: (attempt) => {
      console.error(
        `pmtiles-server (${role}): local persistence was locked; retrying (${attempt}/${attempts - 1})`
      );
    },
    spawnChild: () =>
      new Promise((resolve) => {
        let locked = false;
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        child = spawn(process.execPath, args, {
          cwd: packageDir,
          stdio: ["inherit", "pipe", "pipe"],
          env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
        });
        const forward = (chunk, dest) => {
          dest.write(chunk);
          if (chunk.toString().includes("SQLITE_BUSY")) locked = true;
        };
        child.stdout.on("data", (chunk) => forward(chunk, process.stdout));
        child.stderr.on("data", (chunk) => forward(chunk, process.stderr));
        child.on("error", (error) => {
          console.error(error);
          finish({ code: 1, signal: null, locked });
        });
        child.on("exit", (code, signal) => finish({ code, signal, locked }));
      }),
  });
  process.exit(outcome.code === null ? (outcome.signal ? 1 : 0) : outcome.code);
}
