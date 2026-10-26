#!/usr/bin/env node
// Foreground supervisor for the core (and later data) profile.
// Containers: docker compose up -d --wait. Host processes: concurrently.
// Does not set E2E_TEST_MODE or E2E_TEST_PASSPHRASE. Playwright passes those.
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
  e2eStack,
  profileNames,
  readyUrl,
  screenshotterDev,
  services,
  servicesInProfile,
} from "./dev.config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let logsDir = path.join(root, ".logs");
const waitOnBin = path.join(root, "node_modules", ".bin", "wait-on");

function usage() {
  console.error(
    `Usage: npm run dev -- [--profile ${profileNames.join("|")}] [--ci] [--only <service>]`
  );
  console.error(`Services: ${services.map((service) => service.name).join(", ")}`);
  process.exit(1);
}

function parseArgs(argv) {
  let profile = "core";
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

function envFor(service, profile, localScreenshotter) {
  const env = {
    ...process.env,
    ...service.env,
    ...(profile === "e2e" && service.e2eEnv ? service.e2eEnv : {}),
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

function commandFor(service, ci, profile) {
  const command = ci ? service.ciCommand : service.command;
  if (!command || !ci || !service.dependsOn?.length) {
    return command;
  }
  const selected = new Set(servicesInProfile(profile).map((item) => item.name));
  const urls = [];
  for (const name of service.dependsOn) {
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

function runOne(service) {
  const child = spawn(service.command, {
    cwd: path.join(root, service.cwd),
    env: envFor(service, profile, false),
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

async function startCompose(profile) {
  if ((await portOpen(54321)) && (await portOpen(6379))) {
    report("Postgres and Redis are already listening. Leaving those containers in place.");
    return;
  }
  const args = ["compose"];
  if (profile === "data") {
    args.push("--profile", "data");
  }
  args.push("up", "-d", "--wait");
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

if (only) {
  const service = serviceByName(only);
  if (!service) {
    console.error(`Unknown service: ${only}`);
    usage();
  }
  if (!servicesInProfile(profile).includes(service)) {
    console.error(`${only} is not in the ${profile} profile`);
    process.exit(1);
  }
  runOne(service);
} else {
  const selected = servicesInProfile(profile).flatMap((service) => {
    const command = commandFor(service, ci, profile);
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
    env: envFor(item.service, profile, localScreenshotter),
  }));

  if (selected.length === 0) {
    console.error(`Profile ${profile} has no ${ci ? "--ci " : ""}services to start`);
    process.exit(1);
  }

  try {
    await rm(logsDir, { recursive: true, force: true });
    await mkdir(logsDir, { recursive: true });
    await startCompose(profile);
  } catch (error) {
    report(error instanceof Error ? error.message : String(error));
    process.exit(1);
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
