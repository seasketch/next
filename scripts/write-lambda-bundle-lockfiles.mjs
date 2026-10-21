#!/usr/bin/env node
// CDK's NodejsFunction, when `nodeModules` is set, writes a one-off
// package.json of those modules and runs `npm ci` against depsLockFilePath.
// The workspace lockfile does not match that package.json. These pruned
// lockfiles are the exception named in the phase 2b record.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const bundles = [
  {
    packageJson: "packages/overlay-worker/package.json",
    modules: [
      "undici",
      "@aws-sdk/client-sqs",
      "@aws-sdk/client-secrets-manager",
    ],
    out: "packages/overlay-worker/bundle-package-lock.json",
  },
  {
    packageJson: "packages/fragment-worker/package.json",
    modules: ["undici", "@aws-sdk/client-secrets-manager"],
    out: "packages/fragment-worker/bundle-package-lock.json",
  },
];

for (const bundle of bundles) {
  const pkg = JSON.parse(
    readFileSync(path.join(root, bundle.packageJson), "utf8")
  );
  const dependencies = {};
  for (const name of bundle.modules) {
    const version = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
    if (!version) {
      console.error(`${bundle.packageJson} does not depend on ${name}`);
      process.exit(1);
    }
    dependencies[name] = version;
  }
  const dir = mkdtempSync(path.join(tmpdir(), "lambda-lock-"));
  const manifest = { private: true, dependencies };
  writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  const install = spawnSync(
    "npm",
    ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: dir, stdio: "inherit" }
  );
  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
  writeFileSync(
    path.join(root, bundle.out),
    readFileSync(path.join(dir, "package-lock.json"))
  );
  rmSync(dir, { recursive: true, force: true });
  console.log(`wrote ${bundle.out}`);
}
