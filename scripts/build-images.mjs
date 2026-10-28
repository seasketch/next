#!/usr/bin/env node
// Pre-build every container image that `cdk deploy` builds.
//
// Deploy publishes the image to ECR after a local `docker build`. Doing that
// build first fills the Docker layer cache, so the deploy's build is a cache
// hit and the remaining work is the push. The tag below is local only; CDK
// retags the cached layers as `cdkasset-<hash>`.
//
// Flags have to match the asset options in packages/infra/lib. A different
// --platform or build-arg misses the cache. CDK builds with
// BUILDX_NO_DEFAULT_ATTESTATIONS=1 (provenance attestations make Lambda reject
// the manifest); this script sets the same variable.
//
// Subdivision and the PII classifier pin linux/amd64 in their Dockerfiles and
// the stacks do not pass Platform, so this script does not pass --platform
// for them either.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const images = [
  {
    id: "spatial-uploads-handler",
    stack: "SpatialUploadHandler",
    context: ".",
    file: "packages/spatial-uploads-handler/Dockerfile",
    platform: "linux/amd64",
    tag: "spatial-uploads-handler:latest",
  },
  {
    id: "data-tables-handler",
    stack: "DataTablesHandler",
    context: ".",
    file: "packages/data-tables-handler/Dockerfile",
    platform: "linux/amd64",
    tag: "data-tables-handler:latest",
  },
  {
    id: "subdivision-worker",
    stack: "SeaSketchSubdivisionWorker",
    context: "packages/subdivision-worker",
    tag: "subdivision-worker:local",
  },
  {
    id: "geostats-pii-risk-classifier",
    stack: "SeaSketchGeostatsPiiClassifier",
    context: "packages/geostats-pii-risk-classifier",
    tag: "geostats-pii-risk-classifier:local",
  },
  {
    id: "db-migrate",
    stack: "SeaSketchDB",
    context: "packages/api/migrations",
    buildArgs: { tags: "init-db" },
    tag: "db-migrate:local",
  },
  {
    id: "maintenance",
    stack: "SeaSketchMaintenanceBastion",
    context: "packages/infra/containers/maintenance",
    platform: "linux/amd64",
    buildArgs: { tags: "maintenance" },
    tag: "maintenance:local",
    skip() {
      const key = path.join(root, this.context, "github_key");
      if (fs.existsSync(key)) return null;
      return "packages/infra/containers/maintenance/github_key is missing";
    },
  },
  {
    id: "graphql",
    stack: "SeaSketchGraphQLServer",
    context: "packages/infra/containers/graphql",
    buildArgs() {
      return { commit: process.env.COMMIT ?? "", tags: "graphql" };
    },
    tag: "graphql:local",
    skip() {
      if (process.env.COMMIT) return null;
      return "COMMIT is unset. Export the same sha GraphQLStack will check out during cdk deploy";
    },
  },
];

const assetPattern =
  /DockerImageCode\.fromImageAsset|new DockerImageAsset|ContainerImage\.fromAsset/g;

function countDeclaredImageAssets() {
  const stackDir = path.join(root, "packages/infra/lib");
  let count = 0;
  for (const name of fs.readdirSync(stackDir)) {
    if (!name.endsWith(".ts")) continue;
    const text = fs.readFileSync(path.join(stackDir, name), "utf8");
    count += text.match(assetPattern)?.length ?? 0;
  }
  return count;
}

function assertInventory() {
  const declared = countDeclaredImageAssets();
  if (declared === images.length) return;
  console.error(
    `scripts/build-images.mjs lists ${images.length} images, but packages/infra/lib declares ${declared} Docker image assets.`,
  );
  console.error(
    "Update the image list so the new image is prebuilt with the same docker flags CDK uses.",
  );
  process.exit(1);
}

function resolveBuildArgs(image) {
  if (typeof image.buildArgs === "function") return image.buildArgs();
  return image.buildArgs ?? {};
}

function dockerArgs(image) {
  const args = ["build"];
  for (const [key, value] of Object.entries(resolveBuildArgs(image))) {
    args.push("--build-arg", `${key}=${value}`);
  }
  args.push("--tag", image.tag);
  if (image.file) args.push("--file", image.file);
  if (image.platform) args.push("--platform", image.platform);
  args.push(".");
  return args;
}

function quote(arg) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(arg)) return arg;
  return `'${arg.replaceAll("'", `'\\''`)}'`;
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}s`;
  return `${minutes}m ${rest}s`;
}

function docker(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        BUILDX_NO_DEFAULT_ATTESTATIONS: "1",
      },
    });
    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error("docker was not found on PATH"));
        return;
      }
      reject(err);
    });
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(signal ? `docker killed by ${signal}` : `docker exited ${code}`),
        );
    });
  });
}

function printHelp() {
  console.log(`Pre-build every container image that cdk deploy builds.

cdk deploy runs docker build, then pushes the image to ECR. Building first
fills the local layer cache, so the deploy's build is a cache hit and the
remaining work is the push.

Usage:
  npm run build:images
  npm run build:images -- spatial-uploads-handler data-tables-handler
  npm run build:images -- --dry-run

Images:
${images
  .map((image) => {
    const platform = image.platform ?? "(Dockerfile default)";
    return `  ${image.id.padEnd(32)} ${image.stack.padEnd(32)} ${platform}`;
  })
  .join("\n")}

graphql is skipped unless COMMIT is set to the sha cdk deploy will use.
maintenance is skipped unless packages/infra/containers/maintenance/github_key exists.
Pass an image name to build one of those anyway; a missing requirement is an error.
`);
}

function selectImages(names) {
  const unknown = names.filter((name) => !images.some((image) => image.id === name));
  if (unknown.length > 0) {
    console.error(`Unknown image: ${unknown.join(", ")}`);
    console.error(`Known images: ${images.map((image) => image.id).join(", ")}`);
    process.exit(1);
  }
  if (names.length === 0) return images;
  return images.filter((image) => names.includes(image.id));
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }
  const dryRun = argv.includes("--dry-run");
  const names = argv.filter((arg) => !arg.startsWith("--"));
  assertInventory();
  const selected = selectImages(names);
  const explicit = names.length > 0;
  const skipped = [];
  const queue = [];
  for (const image of selected) {
    const reason = image.skip?.() ?? null;
    if (reason) {
      if (explicit) {
        console.error(`${image.id}: ${reason}`);
        process.exit(1);
      }
      skipped.push({ id: image.id, reason });
      continue;
    }
    const dockerfile = path.join(root, image.context, image.file ?? "Dockerfile");
    if (!fs.existsSync(dockerfile)) {
      console.error(
        `${image.id}: Dockerfile not found at ${path.relative(root, dockerfile)}`,
      );
      process.exit(1);
    }
    queue.push(image);
  }

  for (const { id, reason } of skipped) {
    console.log(`skip ${id}: ${reason}`);
  }

  let built = 0;
  const started = Date.now();
  for (const image of queue) {
    const args = dockerArgs(image);
    const cwd = path.join(root, image.context);
    built += 1;
    console.log(`\n[${built}/${queue.length}] ${image.id} (${image.stack})`);
    console.log(`docker ${args.map(quote).join(" ")}`);
    console.log(`cwd: ${path.relative(root, cwd) || "."}`);
    if (dryRun) continue;

    const imageStarted = Date.now();
    try {
      await docker(args, cwd);
    } catch (err) {
      console.error(`\n${image.id} failed: ${err.message}`);
      process.exit(1);
    }
    console.log(
      `${image.id} ready in ${formatDuration(Date.now() - imageStarted)}`,
    );
  }

  const verb = dryRun ? "would build" : "built";
  console.log(
    `\n${verb} ${built} image${built === 1 ? "" : "s"} in ${formatDuration(Date.now() - started)}`,
  );
  if (skipped.length > 0) {
    console.log(`skipped: ${skipped.map(({ id }) => id).join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
