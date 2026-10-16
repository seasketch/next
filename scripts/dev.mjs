#!/usr/bin/env node
// Foreground supervisor for the core (and later data) profile.
// Containers: docker compose up -d --wait. Host processes: concurrently.
// Does not set E2E_TEST_MODE or E2E_TEST_PASSPHRASE. Playwright passes those.
import { spawn } from "node:child_process";
import { writeSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import concurrently from "concurrently";
import { createStream } from "rotating-file-stream";
import { profileNames, services, servicesInProfile } from "./dev.config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logsDir = path.join(root, ".logs");
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

function commandFor(service, ci) {
  const command = ci ? service.ciCommand : service.command;
  if (!command || !ci || !service.dependsOn?.length) {
    return command;
  }
  const urls = service.dependsOn.map((name) => {
    const dependency = serviceByName(name);
    if (!dependency?.ready) {
      throw new Error(`${service.name} depends on ${name}, which has no ready URL`);
    }
    return dependency.ready;
  });
  return `"${waitOnBin}" ${urls.join(" ")} && ${command}`;
}

function runOne(service) {
  const child = spawn(service.command, {
    cwd: path.join(root, service.cwd),
    env: { ...process.env, ...service.env },
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

function startCompose(profile) {
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

const { profile, ci, only } = parseArgs(process.argv.slice(2));

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
    const command = commandFor(service, ci);
    if (!command) {
      return [];
    }
    return [
      {
        command,
        name: service.name,
        cwd: path.join(root, service.cwd),
        env: { ...process.env, ...service.env },
      },
    ];
  });

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

  for (const service of selected) {
    report(`[${service.name}] ${service.command}`);
  }

  const { result, commands } = concurrently(selected, {
    prefix: "name",
    prefixColors: "auto",
    killOthersOn: ["failure"],
    outputStream: stderrSync,
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

  let exitCode = 0;
  try {
    await result;
  } catch {
    exitCode = 1;
  }
  await Promise.all(streams.map((stream) => new Promise((resolve) => stream.end(resolve))));
  report(`supervisor exiting ${exitCode}`);
  process.exit(exitCode);
}
