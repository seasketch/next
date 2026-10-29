// The only list of host processes `npm run dev` starts.
// VS Code tasks and Playwright call this script; they do not repeat the list.
//
// name: log prefix, `.logs/<name>.log`, and the `--only` argument
// command: dev-mode command (watchers on). A function receives the set of
//   service names being started and returns the command, or undefined to skip.
// ciCommand: `--ci` command. Omit the service from `--ci` when undefined.
// dependsOn / ready: host ordering in `--ci` only. Dev mode starts everything at once.
// startAfter: ordering in every mode, for the few entries that cannot start together.
// profiles: `data` is the default and includes every `core` entry plus the
// data path (local storage, the two pmtiles-server sessions, the handler
// containers, the results queue). `core` is the opt-out: Postgres, Redis, the
// API, the client, and the watchers. `e2e` is the whole stack on its own
// ports, database, and storage directory. An entry with no profiles is
// started only by `--only`.
//
// Which data services actually start also depends on packages/api/.env; see
// scripts/dev.data.mjs.
import { dataStack, invokePath } from "./dev.data.mjs";

const dev = dataStack("dev");
const e2e = dataStack("e2e");

// Local object storage: wrangler dev serving the two local R2 buckets over
// the S3 API. See design-docs/dev-environment/local-data-services.md.
export const localR2Dev = {
  port: dev.ports.localR2,
  url: `http://127.0.0.1:${dev.ports.localR2}`,
};

// Local `wrangler dev` for the bookmark screenshot worker. Chrome runs on this
// machine. The API is pointed here only when this process is started.
// The e2e profile uses its own port so it can run beside `npm run dev`.
export const screenshotterDev = {
  port: 8791,
  token: "local-dev-screenshotter",
  url: "http://127.0.0.1:8791",
};

export const e2eStack = {
  database: e2e.database,
  apiPort: e2e.ports.api,
  clientPort: 13000,
  screenshotterPort: 8792,
  redisDb: 1,
  databaseUrl(user) {
    return `postgres://${user}:password@localhost:54321/${this.database}`;
  },
};

// Compose commands for a data container. `--build` picks up source changes
// since the last start (a cache hit when nothing changed), then the entry
// follows the container's log. CI starts once.
function composeService(name) {
  const up = `docker compose --profile data up -d --build --wait ${name}`;
  return {
    command: `${up} && docker compose --profile data logs -f --no-log-prefix ${name}`,
    ciCommand: up,
  };
}

// Containers whose compose.yaml `develop.watch` section copies rebuilt
// output into the running container. One `docker compose watch` session
// serves all of them: Compose holds a per-project lock, so a second session
// fails with "cannot take exclusive lock".
const watchedContainers = ["spatial-uploads", "subdivision"];

export const services = [
  {
    name: "api",
    cwd: "packages/api",
    command: "npm run watch",
    ciCommand: "npm start",
    // npm start has no NODE_ENV. Test mode, when Playwright sets it, requires development or test.
    env: { NODE_ENV: "development" },
    e2eEnv: {
      PORT: String(e2eStack.apiPort),
      DATABASE_URL: e2eStack.databaseUrl("graphile"),
      ADMIN_DATABASE_URL: e2eStack.databaseUrl("postgres"),
      CLIENT_DOMAIN: `localhost:${e2eStack.clientPort}`,
      REDIS_DB: String(e2eStack.redisDb),
    },
    ready: "http-get://127.0.0.1:3857/graphiql",
    e2eReady: `http-get://127.0.0.1:${e2eStack.apiPort}/graphiql`,
    // The API presigns against local storage and consumes the results queue.
    dependsOn: ["local-r2", "elasticmq"],
    // The results-queue pollers start with the server. Until the ElasticMQ
    // container listens, Docker resets every connection to its published
    // port, so the API waits for the queue in every mode.
    startAfter: ["elasticmq"],
    profiles: ["core"],
  },
  {
    name: "api-tsc",
    cwd: "packages/api",
    command: "npm run build:watch",
    profiles: ["core"],
  },
  {
    name: "db-watch",
    cwd: "packages/api",
    command: "npm run db:watch",
    profiles: ["core"],
  },
  {
    name: "client",
    cwd: "packages/client",
    command: "npm start",
    ciCommand: "npm start",
    env: { BROWSER: "none", SKIP_PREFLIGHT_CHECK: "true" },
    e2eEnv: {
      PORT: String(e2eStack.clientPort),
      REACT_APP_GRAPHQL_ENDPOINT: `http://localhost:${e2eStack.apiPort}/graphql`,
      // react-scripts exits when stdin closes unless CI is true. Playwright
      // does not keep that stdin open. GitHub Actions already sets CI.
      CI: "true",
      // The lint warning dump is large enough to fill Playwright's stderr
      // pipe and kill the stack. e2e does not need the dev overlay.
      DISABLE_ESLINT_PLUGIN: "true",
      // Test mode stores the capture on the API. This is the prefix the forum
      // image URLs are built from.
      REACT_APP_CLOUDFLARE_IMAGES_ENDPOINT: `http://127.0.0.1:${e2eStack.apiPort}/e2e/bookmark-images/`,
    },
    ready: "http-get://127.0.0.1:3000",
    e2eReady: `http-get://127.0.0.1:${e2eStack.clientPort}`,
    // In --ci the client is what Playwright waits on, so this list is the start gate.
    dependsOn: [
      "api",
      "data-tables",
      "spatial-uploads",
      "subdivision",
      "screenshotter",
      "pmtiles-tiles",
      "pmtiles-uploads",
    ],
    profiles: ["core"],
  },
  {
    name: "client-codegen",
    cwd: "packages/client",
    command: "npm run graphql:codegen",
    profiles: ["core"],
  },
  {
    name: "client-css",
    cwd: "packages/client",
    command: "npm run css:watch",
    profiles: ["core"],
  },
  {
    name: "screenshotter",
    cwd: "packages/map-screenshotter",
    command: "npm run dev",
    ciCommand: "npm run dev",
    env: {
      SCREENSHOTTER_DEV_PORT: String(screenshotterDev.port),
      SCREENSHOTTER_DEV_TOKEN: screenshotterDev.token,
    },
    e2eEnv: {
      SCREENSHOTTER_DEV_PORT: String(e2eStack.screenshotterPort),
    },
    ready: `http-get://127.0.0.1:${screenshotterDev.port}/health`,
    e2eReady: `http-get://127.0.0.1:${e2eStack.screenshotterPort}/health`,
    profiles: ["core"],
  },

  // Data path. Ports and injected variables come from scripts/dev.data.mjs.
  {
    name: "local-r2",
    cwd: "packages/local-r2",
    // Objects persist in .data/wrangler across restarts. `npm run setup -- --reset` clears them.
    command: "npm run dev",
    ciCommand: "npm run dev",
    ready: `http-get://127.0.0.1:${dev.ports.localR2}/health`,
    e2eReady: `http-get://127.0.0.1:${e2e.ports.localR2}/health`,
    profiles: ["data"],
  },
  {
    name: "pmtiles-tiles",
    cwd: "packages/pmtiles-server",
    // The tiles host: TileJSON, tiles, data-table queries.
    command: "npm run dev:tiles",
    ciCommand: "npm run dev:tiles",
    ready: `tcp:127.0.0.1:${dev.ports.tiles}`,
    e2eReady: `tcp:127.0.0.1:${e2e.ports.tiles}`,
    // Reads the API's JWKS.
    dependsOn: ["api"],
    profiles: ["data"],
  },
  {
    name: "pmtiles-uploads",
    cwd: "packages/pmtiles-server",
    // The uploads host: every key is an opaque object (archive downloads).
    command: "npm run dev:uploads",
    ciCommand: "npm run dev:uploads",
    ready: `tcp:127.0.0.1:${dev.ports.uploads}`,
    e2eReady: `tcp:127.0.0.1:${e2e.ports.uploads}`,
    dependsOn: ["api"],
    profiles: ["data"],
  },
  {
    name: "elasticmq",
    cwd: ".",
    ...composeService("elasticmq"),
    ready: `tcp:127.0.0.1:${dev.ports.elasticmq}`,
    e2eReady: `tcp:127.0.0.1:${e2e.ports.elasticmq}`,
    profiles: ["data"],
  },
  {
    name: "spatial-uploads",
    cwd: ".",
    // The production image under the Lambda emulator. The API posts to
    // http://localhost:9001/2015-03-31/functions/function/invocations.
    ...composeService("spatial-uploads"),
    ready: `tcp:127.0.0.1:${dev.ports.spatialUploads}`,
    e2eReady: `tcp:127.0.0.1:${e2e.ports.spatialUploads}`,
    profiles: ["data"],
  },
  {
    name: "compose-watch",
    cwd: ".",
    // Copies rebuilt handler output into the running containers. Starts once
    // the containers it watches are up; skipped when none of them run.
    command: (started) => {
      const names = watchedContainers.filter((name) => started.has(name));
      if (names.length === 0) {
        return undefined;
      }
      return `docker compose --profile data watch --no-up ${names.join(" ")}`;
    },
    startAfter: watchedContainers,
    profiles: ["data"],
  },
  {
    name: "spatial-uploads-tsc",
    cwd: "packages/spatial-uploads-handler",
    // Rebuilds dist/, which Compose syncs into the spatial-uploads container.
    command: "npm run watch",
    profiles: ["data"],
  },
  {
    name: "spatial-uploads-host",
    cwd: "packages/spatial-uploads-handler",
    // Opt-in (`npm run dev -- --only spatial-uploads-host`): the handler as a
    // host process on 3005, for someone with GDAL, tippecanoe, and pmtiles
    // installed. Point the API at it with
    // SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER=http://localhost:3005 in .env.
    command: "npm run dev",
    env: { npm_config_cache: "/tmp/seasketch-npx-spatial-uploads" },
    ready: `http-get://127.0.0.1:${dev.ports.spatialUploadsHost}`,
    profiles: [],
  },
  {
    name: "subdivision",
    cwd: ".",
    ...composeService("subdivision"),
    ready: `tcp:127.0.0.1:${dev.ports.subdivision}`,
    e2eReady: `tcp:127.0.0.1:${e2e.ports.subdivision}`,
    profiles: ["data"],
  },
  {
    name: "data-tables",
    cwd: "packages/data-tables-handler",
    // tsx watch recompiles and restarts the dev server. CI starts it once, without watch.
    command: "npm run dev",
    ciCommand: "npx --yes tsx@4.19.3 server.ts",
    env: { npm_config_cache: "/tmp/seasketch-npx-data-tables" },
    ready: `http-get://127.0.0.1:${dev.ports.dataTables}`,
    e2eReady: `http-get://127.0.0.1:${e2e.ports.dataTables}`,
    profiles: ["data"],
  },
];

export const profileNames = ["data", "core", "e2e"];
export const defaultProfile = "data";
export const invokeUrlPath = invokePath;

export function readyUrl(service, profile) {
  if (profile === "e2e" && service.e2eReady) {
    return service.e2eReady;
  }
  return service.ready;
}

// The static membership of a profile. `npm run dev` then removes the entries
// packages/api/.env points at production (scripts/dev.data.mjs).
export function servicesInProfile(profile) {
  return services.filter((service) => {
    if (profile === "core") {
      return service.profiles.includes("core");
    }
    if (profile === "data" || profile === "e2e") {
      return service.profiles.some((name) => name === "core" || name === "data");
    }
    return false;
  });
}
