#!/usr/bin/env node
// The runtime image tag is the content hash of Dockerfile.runtime, so the
// application Dockerfile, the publish workflow, and Compose all agree on
// which image a given checkout needs without a registry lookup.
//
//   node scripts/runtime-image.mjs          print the image reference
//   node scripts/runtime-image.mjs --pin    rewrite the ARG in Dockerfile
//   node scripts/runtime-image.mjs --check  exit 1 when the pin is stale
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDockerfile = path.join(packageDir, "Dockerfile.runtime");
const appDockerfile = path.join(packageDir, "Dockerfile");

export const repository = "ghcr.io/seasketch/spatial-uploads-runtime";
const pinPattern = /^ARG RUNTIME_IMAGE=(\S+)$/m;

export function runtimeTag() {
  const hash = createHash("sha256").update(readFileSync(runtimeDockerfile)).digest("hex");
  return hash.slice(0, 12);
}

export function runtimeImage() {
  return `${repository}:${runtimeTag()}`;
}

export function pinnedImage() {
  const match = pinPattern.exec(readFileSync(appDockerfile, "utf8"));
  if (!match) {
    throw new Error(`${appDockerfile} has no "ARG RUNTIME_IMAGE=" line`);
  }
  return match[1];
}

function pin() {
  const text = readFileSync(appDockerfile, "utf8");
  const next = text.replace(pinPattern, `ARG RUNTIME_IMAGE=${runtimeImage()}`);
  writeFileSync(appDockerfile, next);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === "--pin") {
    pin();
    console.log(`Dockerfile pinned to ${runtimeImage()}`);
  } else if (arg === "--check") {
    const expected = runtimeImage();
    const actual = pinnedImage();
    if (expected !== actual) {
      console.error(
        `Dockerfile pins ${actual} but Dockerfile.runtime hashes to ${expected}.\n` +
          "Run: npm run runtime-image:pin --workspace spatial-uploads-handler"
      );
      process.exit(1);
    }
    console.log(`runtime image pin is current: ${actual}`);
  } else if (arg === undefined) {
    console.log(runtimeImage());
  } else {
    console.error("usage: runtime-image.mjs [--pin|--check]");
    process.exit(1);
  }
}
