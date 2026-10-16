// The only list of host processes `npm run dev` starts.
// VS Code tasks and Playwright call this script; they do not repeat the list.
//
// name: log prefix, `.logs/<name>.log`, and the `--only` argument
// command: dev-mode command (watchers on)
// ciCommand: `--ci` command. Omit the service from `--ci` when undefined.
// dependsOn / ready: host ordering in `--ci` only. Dev mode starts everything at once.
// profiles: `core` is the default. `data` includes core plus its own entries.
// `e2e` is the API and client only, on their own ports and database.

export const e2eStack = {
  database: "seasketch_e2e",
  apiPort: 13857,
  clientPort: 13000,
  redisDb: 1,
  databaseUrl(user) {
    return `postgres://${user}:password@localhost:54321/${this.database}`;
  },
};

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
      // Do not call the dev machine's data-tables handler.
      DATA_TABLES_LAMBDA_DEV_HANDLER: "http://127.0.0.1:1",
    },
    ready: "http-get://127.0.0.1:3857/graphiql",
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
    },
    ready: "http-get://127.0.0.1:3000",
    // In --ci the client is what Playwright waits on, so this list is the start gate.
    dependsOn: ["api", "data-tables", "spatial-uploads", "subdivision"],
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
    name: "data-tables",
    cwd: "packages/data-tables-handler",
    // tsx watch recompiles and restarts the dev server. CI starts it once, without watch.
    command: "npm run dev",
    ciCommand: "npx --yes tsx@4.19.3 server.ts",
    // Both handlers npx-install the same tsx build at startup. One shared
    // cache extracts that folder twice and the loser exits ENOENT.
    env: { npm_config_cache: "/tmp/seasketch-npx-data-tables" },
    ready: "http-get://127.0.0.1:3006",
    profiles: ["core"],
  },
  {
    name: "spatial-uploads",
    cwd: "packages/spatial-uploads-handler",
    command: "npm run dev",
    ciCommand: "npx --yes tsx@4.19.3 server.ts",
    // Separate npx cache from data-tables. See that entry.
    env: { npm_config_cache: "/tmp/seasketch-npx-spatial-uploads" },
    ready: "http-get://127.0.0.1:3005",
    profiles: ["core"],
  },
  {
    name: "subdivision",
    cwd: ".",
    // Dev rebuilds into the running container. CI builds once and waits until the port is open.
    command:
      "docker compose --profile workers up -d --wait subdivision && docker compose --profile workers watch --no-up subdivision",
    ciCommand: "docker compose --profile workers up -d --wait subdivision",
    ready: "tcp:127.0.0.1:9000",
    profiles: ["core"],
  },
];

export const profileNames = ["core", "data", "e2e"];

export function readyUrl(service, profile) {
  if (profile === "e2e" && service.name === "api") {
    return `http-get://127.0.0.1:${e2eStack.apiPort}/graphiql`;
  }
  if (profile === "e2e" && service.name === "client") {
    return `http-get://127.0.0.1:${e2eStack.clientPort}`;
  }
  return service.ready;
}

export function servicesInProfile(profile) {
  return services.filter((service) => {
    if (profile === "e2e") {
      return service.name === "api" || service.name === "client";
    }
    if (profile === "core") {
      return service.profiles.includes("core");
    }
    if (profile === "data") {
      return service.profiles.some((name) => name === "core" || name === "data");
    }
    return false;
  });
}
