// Where the local data services listen, and which of them `npm run dev`
// should start and point the API at.
//
// Two controls (design-docs/dev-environment/local-data-services.md):
//   - the profile decides which processes start (`data`, the default, starts
//     everything here; `core` starts none of it);
//   - packages/api/.env decides, per integration, whether the API talks to a
//     local service or to production. If the production variable for an
//     integration is set there, that service is not started and nothing is
//     injected for it. Otherwise the local service is started and the
//     variables that name it are injected into the processes that call it,
//     ahead of .env and the shell.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  credentials as localR2Credentials,
  defaultPort as localR2Port,
  endpoint as localR2Endpoint,
  repoRoot,
  spatialUploadsBucket,
  tilesBucket,
} from "../packages/local-r2/config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const invokePath = "/2015-03-31/functions/function/invocations";

// Host ports. The e2e profile offsets every one so a Playwright run can
// execute an upload journey beside a developer's own stack.
const devPorts = {
  api: 3857,
  localR2: localR2Port,
  tiles: 8787,
  uploads: 8788,
  spatialUploads: 9001,
  spatialUploadsHost: 3005,
  subdivision: 9000,
  elasticmq: 9324,
  dataTables: 3006,
};

const e2ePorts = {
  api: 13857,
  localR2: 18333,
  tiles: 18787,
  uploads: 18788,
  spatialUploads: 19001,
  spatialUploadsHost: 13005,
  subdivision: 19000,
  elasticmq: 19324,
  dataTables: 13006,
};

// One description of the local data stack per profile: ports, the wrangler
// persistence directory, the Compose project the containers run under, and
// the database the handlers write progress to.
export function dataStack(profile) {
  if (profile === "e2e") {
    return {
      ports: e2ePorts,
      persistDir: path.join(root, ".data", "wrangler-e2e"),
      composeProject: "seasketch-e2e",
      database: "seasketch_e2e",
    };
  }
  return {
    ports: devPorts,
    persistDir: path.join(root, ".data", "wrangler"),
    composeProject: "seasketch",
    database: "seasketch",
  };
}

// Each integration: the variable that, when set in packages/api/.env, means
// "use production", and the supervisor entries that stay stopped in that case.
export const integrations = [
  {
    id: "storage",
    productionVariable: "R2_ENDPOINT",
    services: ["local-r2", "pmtiles-tiles", "pmtiles-uploads"],
    isProduction: (value) => !isLocalUrl(value),
  },
  {
    id: "spatial uploads",
    productionVariable: "SPATIAL_UPLOADS_LAMBDA_ARN",
    services: ["spatial-uploads", "spatial-uploads-tsc"],
  },
  {
    id: "subdivision",
    productionVariable: "SUBDIVISION_WORKER_LAMBDA_ARN",
    services: ["subdivision"],
  },
  {
    id: "data tables",
    productionVariable: "DATA_TABLES_HANDLER_LAMBDA_ARN",
    services: ["data-tables"],
  },
  {
    id: "results queue",
    productionVariable: "OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL",
    services: ["elasticmq"],
    isProduction: (value) => !isLocalUrl(value),
  },
];

function isLocalUrl(value) {
  try {
    const { hostname } = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal"].includes(hostname);
  } catch {
    return false;
  }
}

export function readApiDotenv() {
  const file = path.join(root, "packages", "api", ".env");
  if (!existsSync(file)) {
    return {};
  }
  return dotenv.parse(readFileSync(file));
}

function isSet(value) {
  return typeof value === "string" && value.trim() !== "";
}

// Integrations packages/api/.env points at production.
export function productionIntegrations(apiEnv = readApiDotenv()) {
  return integrations.filter((integration) => {
    const value = apiEnv[integration.productionVariable];
    if (!isSet(value)) {
      return false;
    }
    return integration.isProduction ? integration.isProduction(value.trim()) : true;
  });
}

export function servicesStoppedForProduction(apiEnv = readApiDotenv()) {
  return new Set(productionIntegrations(apiEnv).flatMap((item) => item.services));
}

function isLocal(production, id) {
  return !production.some((integration) => integration.id === id);
}

// Variables a process needs to use the local storage. The API, the data
// tables handler, and the host-mode upload handler all take these.
function storageEnv(stack) {
  const { ports } = stack;
  return {
    R2_ENDPOINT: localR2Endpoint(ports.localR2, "localhost"),
    R2_ACCESS_KEY_ID: localR2Credentials.accessKeyId,
    R2_SECRET_ACCESS_KEY: localR2Credentials.secretAccessKey,
    R2_TILES_BUCKET: tilesBucket,
    SPATIAL_UPLOADS_BUCKET: spatialUploadsBucket,
    TILES_REMOTE: `r2://${tilesBucket}`,
    UPLOADS_BASE_URL: `http://localhost:${ports.uploads}`,
    TILES_BASE_URL: `http://localhost:${ports.tiles}`,
  };
}

// What the Lambda handlers get from CDK in production, with local values.
function handlerEnv(stack) {
  return {
    ...storageEnv(stack),
    BUCKET: spatialUploadsBucket,
    RESOURCES_REMOTE: `r2://${tilesBucket}`,
    PGHOST: "localhost",
    PGPORT: "54321",
    PGUSER: "postgres",
    PGPASSWORD: "password",
    PGDATABASE: stack.database,
    PGREGION: "us-west-2",
    AWS_REGION: "us-west-2",
  };
}

// Interpolated by compose.yaml. Every compose command for a data container
// gets these so the e2e project lands on its own ports and database.
export function composeEnv(profile) {
  const stack = dataStack(profile);
  const { ports } = stack;
  return {
    COMPOSE_PROJECT_NAME: stack.composeProject,
    SEASKETCH_DB_NAME: stack.database,
    LOCAL_R2_PORT: String(ports.localR2),
    PMTILES_TILES_PORT: String(ports.tiles),
    PMTILES_UPLOADS_PORT: String(ports.uploads),
    SPATIAL_UPLOADS_PORT: String(ports.spatialUploads),
    SUBDIVISION_PORT: String(ports.subdivision),
    ELASTICMQ_PORT: String(ports.elasticmq),
  };
}

export function queueUrl(stack) {
  return `http://localhost:${stack.ports.elasticmq}/000000000000/overlay-engine-results`;
}

// Variables the supervisor injects into one service for the given profile.
// `started` is the set of service names actually being started, so a caller
// is only pointed at a local service that will exist.
export function dataEnvFor(serviceName, profile, started, apiEnv = readApiDotenv()) {
  const stack = dataStack(profile);
  const { ports } = stack;
  const production = productionIntegrations(apiEnv);
  const env = {};

  switch (serviceName) {
    case "api": {
      if (isLocal(production, "storage") && started.has("local-r2")) {
        Object.assign(env, storageEnv(stack));
      }
      if (isLocal(production, "spatial uploads") && started.has("spatial-uploads")) {
        env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER = `http://localhost:${ports.spatialUploads}${invokePath}`;
      }
      if (isLocal(production, "subdivision") && started.has("subdivision")) {
        env.SUBDIVISION_WORKER_DEV_HANDLER = `http://localhost:${ports.subdivision}${invokePath}`;
      }
      if (isLocal(production, "data tables") && started.has("data-tables")) {
        env.DATA_TABLES_LAMBDA_DEV_HANDLER = `http://localhost:${ports.dataTables}`;
      }
      if (isLocal(production, "results queue") && started.has("elasticmq")) {
        env.OVERLAY_ENGINE_WORKER_SQS_QUEUE_URL = queueUrl(stack);
        env.SQS_ENDPOINT = `http://localhost:${ports.elasticmq}`;
        env.AWS_REGION = "us-west-2";
      }
      break;
    }
    case "data-tables": {
      if (isLocal(production, "storage") && started.has("local-r2")) {
        Object.assign(env, handlerEnv(stack));
      }
      env.PORT = String(ports.dataTables);
      break;
    }
    case "spatial-uploads-host": {
      if (isLocal(production, "storage") && started.has("local-r2")) {
        Object.assign(env, handlerEnv(stack));
      }
      env.PORT = String(ports.spatialUploadsHost);
      break;
    }
    case "spatial-uploads":
    case "subdivision":
    case "elasticmq": {
      Object.assign(env, composeEnv(profile));
      break;
    }
    case "local-r2": {
      env.LOCAL_R2_PORT = String(ports.localR2);
      env.LOCAL_R2_PERSIST_TO = stack.persistDir;
      break;
    }
    case "pmtiles-tiles":
    case "pmtiles-uploads": {
      env.PMTILES_DEV_PORT = String(
        serviceName === "pmtiles-tiles" ? ports.tiles : ports.uploads
      );
      env.LOCAL_R2_PERSIST_TO = stack.persistDir;
      env.JWKS_URL = `http://127.0.0.1:${ports.api}/.well-known/jwks.json`;
      break;
    }
    default:
      break;
  }
  return env;
}

// Lines for the supervisor to print: which integrations use production, and
// which .env values the injected locals replace.
export function dataNotices(profile, started, apiEnv = readApiDotenv()) {
  const lines = [];
  for (const integration of productionIntegrations(apiEnv)) {
    lines.push(
      `${integration.productionVariable} is set in packages/api/.env: ${integration.id} uses production and ${integration.services.join(", ")} will not start.`
    );
  }
  const injected = dataEnvFor("api", profile, started, apiEnv);
  for (const [name, value] of Object.entries(injected)) {
    const existing = apiEnv[name];
    if (isSet(existing) && existing.trim() !== value) {
      lines.push(
        `${name} in packages/api/.env is replaced by the local service value ${value} while that service runs.`
      );
    }
  }
  return lines;
}

export { repoRoot };
