#!/usr/bin/env node
// Foreground supervisor for the data (default), core, and e2e profiles.
// Containers: docker compose up -d --wait. Host processes: concurrently.
// Does not set E2E_TEST_MODE or E2E_TEST_PASSPHRASE. Playwright passes those.
//
// Which data services start, and which variables point the API at them, is
// decided in scripts/dev.data.mjs from packages/api/.env.
import { spawn } from "node:child_process";
import net from "node:net";
import { existsSync, readFileSync, writeSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import concurrently from "concurrently";
import { createStream } from "rotating-file-stream";
import {
  defaultProfile,
  e2eStack,
  profileNames,
  readyUrl,
  screenshotterDev,
  services,
  servicesInProfile,
} from "./dev.config.mjs";
import {
  dataEnvFor,
  dataNotices,
  readApiDotenv,
  servicesStoppedForProduction,
} from "./dev.data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let logsDir = path.join(root, ".logs");
const waitOnBin = path.join(root, "node_modules", ".bin", "wait-on");

function usage() {
  console.error(
    `Usage: npm run dev -- [--profile ${profileNames.join("|")}] [--ci] [--only <service>]`
  );
  console.error(`Services: ${services.map((service) => service.name).join(", ")}`);
  console.error(`The default profile is ${defaultProfile}.`);
  process.exit(1);
}

function parseArgs(argv) {
  let profile = defaultProfile;
  let ci = false;
  let only = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--ci") {
      ci = true;
    } else if (arg === "--profile") {
      profile = argv[++i];
      if (!profile || profile.startsWith("--")) {
        usage();
      }
    } else if (arg === "--only") {
      only = argv[++i];
      if (!only || only.startsWith("--")) {
        usage();
      }
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      console.error(`Unexpected argument: ${arg}`);
      usage();
    }
  }
  if (!profileNames.includes(profile)) {
    console.error(`Unknown profile: ${profile}`);
    usage();
  }
  return { profile, ci, only };
}

function serviceByName(name) {
  return services.find((service) => service.name === name);
}

// The services the profile starts, less those packages/api/.env points at
// production. Computed once; `--only` and the dependency gates use the same set.
function selectServices(profile, apiEnv) {
  const stopped = servicesStoppedForProduction(apiEnv);
  return servicesInProfile(profile).filter((service) => !stopped.has(service.name));
}

function envFor(service, profile, localScreenshotter, started, apiEnv) {
  const env = {
    ...process.env,
    ...service.env,
    ...(profile === "e2e" && service.e2eEnv ? service.e2eEnv : {}),
    // Local data services the supervisor starts win over .env and the shell.
    // Setting the production variable in .env is how to opt out per service.
    ...dataEnvFor(service.name, profile, started, apiEnv),
  };
  if (localScreenshotter && service.name === "api") {
    env.SCREENSHOTTER_URL =
      profile === "e2e"
        ? `http://127.0.0.1:${e2eStack.screenshotterPort}`
        : screenshotterDev.url;
    env.SCREENSHOTTER_TOKEN = screenshotterDev.token;
    if (!env.MAPBOX_ACCESS_TOKEN && process.env.REACT_APP_MAPBOX_ACCESS_TOKEN) {
      env.MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
    }
  }
  return env;
}

function resolveCommand(service, ci, started) {
  const command = ci ? service.ciCommand : service.command;
  return typeof command === "function" ? command(started) : command;
}

function commandFor(service, ci, profile, started) {
  const command = resolveCommand(service, ci, started);
  if (!command) {
    return command;
  }
  // startAfter gates every mode; dependsOn only --ci.
  const gates = [...(service.startAfter ?? []), ...(ci ? service.dependsOn ?? [] : [])];
  if (gates.length === 0) {
    return command;
  }
  const selected = started;
  const urls = [];
  for (const name of gates) {
    if (!selected.has(name)) {
      continue;
    }
    const dependency = serviceByName(name);
    const ready = dependency ? readyUrl(dependency, profile) : undefined;
    if (!ready) {
      throw new Error(`${service.name} depends on ${name}, which has no ready URL`);
    }
    urls.push(ready);
  }
  if (urls.length === 0) {
    return command;
  }
  return `"${waitOnBin}" ${urls.join(" ")} && ${command}`;
}

function runOne(service, started, apiEnv) {
  const command = resolveCommand(service, false, started);
  if (!command) {
    report(`${service.name} has nothing to start with the current selection`);
    process.exit(1);
  }
  const child = spawn(command, {
    cwd: path.join(root, service.cwd),
    env: envFor(service, profile, false, started, apiEnv),
    stdio: "inherit",
    shell: true,
  });
  const forward = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));
  child.on("exit", (code, signal) => {
    process.exit(code === null ? (signal ? 1 : 0) : code);
  });
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

function composeContainerRunning(name) {
  return new Promise((resolve) => {
    const child = spawn("docker", ["ps", "-q", "--filter", `name=^${name}$`], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.on("error", () => resolve(false));
    child.on("exit", () => resolve(out.trim().length > 0));
  });
}

// Postgres and Redis. The data containers are each started by their own
// entry in dev.config.mjs so they get the profile's ports and project name.
// A Postgres on 54321 that compose.yaml did not start is left alone. The
// compose-managed one goes through `up` every time, which is a no-op when
// nothing changed and recreates the container when compose.yaml did (the
// database lives in a volume that survives that).
async function startCompose() {
  if (
    (await portOpen(54321)) &&
    (await portOpen(6379)) &&
    !(await composeContainerRunning("seasketch_db"))
  ) {
    report("Postgres and Redis are already listening. Leaving those containers in place.");
    return;
  }
  const args = ["compose", "up", "-d", "--wait", "db", "redis"];
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker compose exited ${code}`));
      }
    });
  });
}

// Playwright's webServer shows stderr immediately and hides stdout unless asked.
// process.exit() also drops buffered pipe writes, which is how CI lost the
// reason a --ci process quit. Write the supervisor log with writeSync.
function report(message) {
  writeSync(2, message.endsWith("\n") ? message : `${message}\n`);
}

const stderrSync = new Writable({
  write(chunk, _encoding, callback) {
    try {
      writeSync(2, chunk);
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  },
});

// The e2e profile still records each service under .logs/e2e. Playwright would
// otherwise prefix every line into the test run, which hides the journey list.
const discardOutput = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

function logStream(name) {
  return createStream(
    (time, index) => {
      if (!time) {
        return `${name}.log`;
      }
      return `${name}.${index}.log`;
    },
    { size: "20M", maxFiles: 3, path: logsDir }
  );
}

// Workspace packages load from their gitignored dist/ output, so after a
// fresh `npm ci` the API and client cannot start until `npm run build` runs.
// Only the packages the root tsconfig references are checked; that is what
// `npm run build` builds.
function unbuiltPackages() {
  const solution = readFileSync(path.join(root, "tsconfig.json"), "utf8");
  const dirs = [...solution.matchAll(/"path":\s*"([^"]+)"/g)].map((m) => m[1]);
  const missing = [];
  for (const dir of dirs) {
    const manifestPath = path.join(root, dir, "package.json");
    if (!existsSync(manifestPath)) {
      continue;
    }
    const { name, main } = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (
      typeof main === "string" &&
      main.replace(/^\.\//, "").startsWith("dist/") &&
      !existsSync(path.join(root, dir, main))
    ) {
      missing.push(name || dir);
    }
  }
  return missing;
}

const { profile, ci, only } = parseArgs(process.argv.slice(2));
if (profile === "e2e") {
  logsDir = path.join(root, ".logs", "e2e");
}

const unbuilt = unbuiltPackages();
if (unbuilt.length > 0) {
  report(
    `These workspace packages have not been built: ${unbuilt.join(", ")}.\n` +
      "Run `npm run build` from the repo root (needed after a fresh install), then `npm run dev` again."
  );
  process.exit(1);
}

const apiEnv = readApiDotenv();
const selectedServices = selectServices(profile, apiEnv);
const started = new Set(selectedServices.map((service) => service.name));

if (only) {
  const service = serviceByName(only);
  if (!service) {
    console.error(`Unknown service: ${only}`);
    usage();
  }
  const optIn = service.profiles.length === 0;
  if (!optIn && !servicesInProfile(profile).includes(service)) {
    console.error(`${only} is not in the ${profile} profile`);
    process.exit(1);
  }
  if (servicesStoppedForProduction(apiEnv).has(service.name)) {
    report(
      `${only} is pointed at production by packages/api/.env. Starting it anyway; the API will not use it.`
    );
  }
  runOne(service, started, apiEnv);
} else {
  const selected = selectedServices.flatMap((service) => {
    const command = commandFor(service, ci, profile, started);
    if (!command) {
      return [];
    }
    return [{ service, command }];
  });
  const localScreenshotter = selected.some((item) => item.service.name === "screenshotter");
  const processes = selected.map((item) => ({
    command: item.command,
    name: item.service.name,
    cwd: path.join(root, item.service.cwd),
    env: envFor(item.service, profile, localScreenshotter, started, apiEnv),
  }));

  if (selected.length === 0) {
    console.error(`Profile ${profile} has no ${ci ? "--ci " : ""}services to start`);
    process.exit(1);
  }

  try {
    await rm(logsDir, { recursive: true, force: true });
    await mkdir(logsDir, { recursive: true });
    await startCompose();
  } catch (error) {
    report(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  for (const line of dataNotices(profile, started, apiEnv)) {
    report(line);
  }
  if (profile === "e2e") {
    report(`Service logs: ${logsDir}`);
  } else {
    for (const service of processes) {
      report(`[${service.name}] ${service.command}`);
    }
  }

  const { result, commands } = concurrently(processes, {
    prefix: "name",
    prefixColors: "auto",
    killOthersOn: ["failure"],
    outputStream: profile === "e2e" ? discardOutput : stderrSync,
  });

  const streams = commands.map((command) => {
    const stream = logStream(command.name);
    const write = (chunk) => {
      stream.write(chunk);
    };
    // concurrently exposes stdout/stderr as observables, not Node streams.
    command.stdout.subscribe(write);
    command.stderr.subscribe(write);
    return stream;
  });

  const failed = [];
  let exitCode = 0;
  try {
    await result;
  } catch (error) {
    exitCode = 1;
    const events = Array.isArray(error) ? error : [error];
    for (const event of events) {
      if (event?.killed) {
        continue;
      }
      const name = event?.command?.name ?? "process";
      failed.push(name);
      report(`[${name}] exited ${event?.exitCode}`);
    }
  }
  await Promise.all(streams.map((stream) => new Promise((resolve) => stream.end(resolve))));
  if (profile === "e2e") {
    for (const name of failed) {
      const file = path.join(logsDir, `${name}.log`);
      if (!existsSync(file)) {
        continue;
      }
      const tail = readFileSync(file, "utf8").trimEnd().split("\n").slice(-40).join("\n");
      if (tail) {
        report(`[${name}] log tail:\n${tail}`);
      }
    }
  }
  report(`supervisor exiting ${exitCode}`);
  process.exit(exitCode);
}
