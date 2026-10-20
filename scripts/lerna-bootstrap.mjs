#!/usr/bin/env node
// Lerna 6 rewrites each package.json before npm ci: it deletes `scripts` and
// every dependency it will symlink instead of install, then copies the
// original to package.json.lerna_backup. Ctrl+C loses the race. The backup
// is already renamed back, and npm writes the stripped manifest again as it
// dies. Snapshot the manifests first and put them back unless lerna exits 0.
import { spawn } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function packageJsonPaths(repoRoot) {
  const paths = [];
  const rootManifest = path.join(repoRoot, "package.json");
  if (existsSync(rootManifest)) {
    paths.push(rootManifest);
  }
  const packagesDir = path.join(repoRoot, "packages");
  if (!existsSync(packagesDir)) {
    return paths;
  }
  for (const name of readdirSync(packagesDir)) {
    const manifest = path.join(packagesDir, name, "package.json");
    if (existsSync(manifest) && statSync(manifest).isFile()) {
      paths.push(manifest);
    }
  }
  return paths;
}

export function snapshotPackageJsons(paths) {
  return new Map(paths.map((manifest) => [manifest, readFileSync(manifest)]));
}

export function restorePackageJsons(snapshots) {
  const restored = [];
  for (const [manifest, original] of snapshots) {
    const backup = `${manifest}.lerna_backup`;
    if (existsSync(backup)) {
      try {
        unlinkSync(backup);
      } catch {
        // The killed lerna process may already have removed it.
      }
    }
    let current = null;
    try {
      current = readFileSync(manifest);
    } catch {
      current = null;
    }
    if (!current || !current.equals(original)) {
      writeFileSync(manifest, original);
      restored.push(manifest);
    }
  }
  return restored;
}

function main() {
  const lernaBin = path.join(root, "node_modules", ".bin", "lerna");
  if (!existsSync(lernaBin)) {
    console.error("lerna is not installed. Run npm ci at the repo root first.");
    process.exit(1);
  }

  const snapshots = snapshotPackageJsons(packageJsonPaths(root));
  let interrupted = false;
  let settled = false;

  const child = spawn(lernaBin, ["bootstrap", ...process.argv.slice(2)], {
    cwd: root,
    stdio: "inherit",
  });

  const stop = (signal) => {
    interrupted = true;
    if (!child.killed) {
      child.kill(signal);
    }
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (settled) {
      return;
    }
    settled = true;
    const failed = interrupted || signal != null || code !== 0;
    if (failed) {
      const restored = restorePackageJsons(snapshots);
      if (restored.length > 0) {
        console.error(
          `Restored package.json files after lerna bootstrap stopped:\n${restored
            .map((manifest) => `  ${path.relative(root, manifest)}`)
            .join("\n")}`
        );
      }
    }
    if (interrupted || signal === "SIGINT") {
      process.exit(130);
    }
    if (signal) {
      process.exit(1);
    }
    process.exit(code ?? 1);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
