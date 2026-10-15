#!/usr/bin/env node
// Follow `.logs/<service>.log`, or every current service log.
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logsDir = path.join(root, ".logs");
const name = process.argv[2];

if (process.argv.length > 3 || (name && name.startsWith("--"))) {
  console.error("Usage: npm run logs -- [service]");
  process.exit(1);
}

function follow(files) {
  const child = spawn("tail", ["-n", "200", "-F", ...files], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code === null ? 1 : code));
}

if (name) {
  follow([path.join(logsDir, `${name}.log`)]);
} else {
  let names = [];
  try {
    names = await readdir(logsDir);
  } catch {
    names = [];
  }
  const files = names
    .filter((file) => file.endsWith(".log") && !/\.\d+\.log$/.test(file))
    .map((file) => path.join(logsDir, file));
  if (files.length === 0) {
    console.error("Run npm run dev first.");
    process.exit(1);
  }
  follow(files);
}
