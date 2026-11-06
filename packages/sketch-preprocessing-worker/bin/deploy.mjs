#!/usr/bin/env node
// Production deploy.
//
// The R2 bucket name is not committed. Wrangler replaces the Worker's
// bindings with the configuration it uploads, and it cannot read a Worker
// secret back to discover a bucket name, so this command reads
// SSN_TILES_BUCKET from its environment and refuses to start without it.
//
// UPLOADS_HOST is a required Worker secret. Wrangler aborts the upload when
// that secret is not already stored on the Worker.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wranglerBin } from "../../local-r2/config.mjs";

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const bucket = String(process.env.SSN_TILES_BUCKET || "").trim();
if (!bucket) {
  console.error(
    "SSN_TILES_BUCKET is required. Set it to this deployment's R2 bucket name and run npm run deploy again."
  );
  process.exit(1);
}

function stripJsonc(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/.*$/gm, "$1");
}

const config = JSON.parse(
  stripJsonc(readFileSync(path.join(packageDir, "wrangler.jsonc"), "utf8"))
);
delete config.$schema;
config.main = path.resolve(packageDir, config.main);
const binding = (config.r2_buckets || []).find(
  (entry) => entry.binding === "SSN_TILES"
);
if (!binding) {
  console.error("wrangler.jsonc has no SSN_TILES R2 binding.");
  process.exit(1);
}
binding.bucket_name = bucket;

const dir = mkdtempSync(path.join(tmpdir(), "sketch-preprocessing-deploy-"));
const configPath = path.join(dir, "wrangler.json");
writeFileSync(configPath, JSON.stringify(config));
const child = spawnSync(
  process.execPath,
  [
    wranglerBin,
    "deploy",
    "--minify",
    "--config",
    configPath,
    ...process.argv.slice(2),
  ],
  {
    cwd: packageDir,
    stdio: "inherit",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  }
);
rmSync(dir, { recursive: true, force: true });
process.exit(child.status === null ? 1 : child.status);
