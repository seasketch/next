#!/usr/bin/env node
// Points this clone at .githooks so git itself refuses numbered migration commits.
// npm install runs this from a full checkout. Docker images that copy package.json
// without this script skip prepare. A missing git checkout is fine.

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hook = path.join(root, ".githooks", "pre-commit");

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: process.cwd(),
    stdio: "ignore",
  });
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: process.cwd(),
    stdio: "ignore",
  });
  if (existsSync(hook)) chmodSync(hook, 0o755);
} catch {
  // Not a git checkout, or git is unavailable. Install must still succeed.
}
