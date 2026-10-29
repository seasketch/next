#!/usr/bin/env node
// Serve the local buckets over Miniflare's S3 API.
//
//   LOCAL_R2_PORT           default 8333
//   LOCAL_R2_PERSIST_TO     default <repo>/.data/wrangler
//   LOCAL_R2_IP             default 0.0.0.0 so containers can reach it
//   LOCAL_R2_ALLOWED_HOSTS  extra Host header values to accept, comma separated
//
// This starts Miniflare directly instead of `wrangler dev`. Miniflare refuses
// requests under /cdn-cgi/ (where the S3 API lives) unless the Host header is
// localhost, a loopback address, or one of the Worker's routes. Under
// `wrangler dev` the check runs in a proxy instance that has no routes, so
// the handler containers, which reach this process as host.docker.internal,
// get "403 Invalid Host header" from it. Starting Miniflare ourselves lets us
// declare host.docker.internal as a route and the S3 API accepts it.
//
// Every local Worker session that should see the same objects uses the same
// persistence directory. The e2e profile points this at .data/wrangler-e2e.
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  buckets,
  compatibilityDate,
  defaultPersistDir,
  defaultPort,
  envValues,
  miniflare,
  packageDir,
  repoRoot,
} from "../config.mjs";

const { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = miniflare;

const port = Number(process.env.LOCAL_R2_PORT || defaultPort);
const persistTo = path.resolve(
  repoRoot,
  process.env.LOCAL_R2_PERSIST_TO || defaultPersistDir
);
const ip = process.env.LOCAL_R2_IP || "0.0.0.0";
const allowedHosts = [
  "host.docker.internal",
  ...(process.env.LOCAL_R2_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
];

mkdirSync(persistTo, { recursive: true });

const r2Buckets = {};
for (const bucket of buckets) {
  r2Buckets[bucket.binding] = {
    id: bucket.name,
    s3Credentials: {
      accessKeyId: bucket.accessKeyId,
      secretAccessKey: bucket.secretAccessKey,
    },
  };
}

console.log(`local-r2: S3 API at ${envValues(port).R2_ENDPOINT}`);
console.log(`local-r2: objects persist in ${path.relative(repoRoot, persistTo)}`);
console.log(`local-r2: also answering to Host ${allowedHosts.join(", ")}`);
console.log("local-r2: values for a .env that uses this storage:");
for (const [name, value] of Object.entries(envValues(port))) {
  console.log(`  ${name}=${value}`);
}

const mf = new Miniflare(
  convertV4MiniflareOptions({
    host: ip,
    port,
    log: new Log(LogLevel.INFO),
    // wrangler dev stores state under <persist-to>/v3. Use the same layout so
    // the pmtiles-server sessions, which still run under wrangler dev with
    // --persist-to <this directory>, read the objects written here.
    resourcePersistencePath: path.join(persistTo, "v3"),
    resourceTmpPath: path.join(packageDir, ".wrangler", "tmp"),
    workers: [
      {
        name: "local-r2",
        compatibilityDate,
        modules: true,
        modulesRoot: packageDir,
        scriptPath: path.join(packageDir, "src", "index.js"),
        routes: allowedHosts.map((host) => `${host}/*`),
        r2Buckets,
      },
    ],
  })
);

await mf.ready;
console.log(`local-r2: ready on http://${ip}:${port}`);

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    mf.dispose().then(
      () => process.exit(0),
      (error) => {
        console.error(error);
        process.exit(1);
      }
    );
  });
}
