#!/usr/bin/env node
// Run each workspace package's test script. Playwright stays on `npm run e2e`,
// which restores a database and starts the stack.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skip = new Set(["@seasketch/e2e"]);
const packagesDir = path.join(root, "packages");

const workspaces = [];
for (const name of readdirSync(packagesDir)) {
  const manifestPath = path.join(packagesDir, name, "package.json");
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!manifest.scripts?.test || skip.has(manifest.name)) {
    continue;
  }
  workspaces.push(manifest.name);
}

let failed = 0;
for (const name of workspaces) {
  console.log(`\n# test ${name}`);
  const result = spawnSync("npm", ["test", "--workspace", name], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    failed += 1;
  }
}
process.exit(failed === 0 ? 0 : 1);
