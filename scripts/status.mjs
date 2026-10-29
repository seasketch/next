#!/usr/bin/env node
// One line per host service, then `docker compose ps`.
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultProfile, servicesInProfile } from "./dev.config.mjs";
import { servicesStoppedForProduction } from "./dev.data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function probeTcp(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (up) => {
      socket.destroy();
      resolve(up);
    };
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    socket.setTimeout(2000, () => done(false));
  });
}

function probe(ready) {
  if (ready.startsWith("tcp:")) {
    const [host, port] = ready.slice("tcp:".length).split(":");
    return probeTcp(host, Number(port));
  }
  const url = new URL(ready.replace(/^http-get:\/\//, "http://"));
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function readyPort(ready) {
  if (ready.startsWith("tcp:")) {
    return ready.slice(ready.lastIndexOf(":") + 1);
  }
  return new URL(ready.replace(/^http-get:\/\//, "http://")).port;
}

const services = servicesInProfile(defaultProfile);
// Services .env would keep stopped. `npm run dev -- --local-data` starts them
// anyway, so probe first and only explain a service that is not listening.
const stopped = servicesStoppedForProduction();
for (const service of services) {
  if (!service.ready) {
    console.log(`${service.name}: no probe`);
    continue;
  }
  const up = await probe(service.ready);
  const port = readyPort(service.ready);
  if (up) {
    console.log(`${service.name}: listening (${port})`);
  } else if (stopped.has(service.name)) {
    console.log(
      `${service.name}: not started (packages/api/.env points at production; npm run dev -- --local-data starts it)`
    );
  } else {
    console.log(`${service.name}: not responding`);
  }
}

const compose = spawn("docker", ["compose", "ps"], { cwd: root, stdio: "inherit" });
compose.on("exit", (code) => process.exit(code === null ? 1 : code));
