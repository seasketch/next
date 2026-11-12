/**
 * Deterministic Tailwind CLI wrapper.
 *
 * Home and work machines previously disagreed on src/index.css because:
 * - `npx tailwindcss` can resolve a different CLI than the locked 3.4.17
 * - Autoprefixer follows browserslist, which changes with NODE_ENV and
 *   whatever caniuse-lite happens to be in node_modules after an update
 * - A developer-local BROWSERSLIST / cache can override package.json
 *
 * css:watch does not pass --watch to Tailwind. That mode reuses its context,
 * so a class first seen after startup gets a later sort index than the same
 * class in a one-shot css:build, and CI's css:check fails. Each change runs
 * the one-shot build instead.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

process.env.BROWSERSLIST = ">0.2%, not dead, not op_mini all";
process.env.BROWSERSLIST_ENV = "production";
process.env.BROWSERSLIST_IGNORE_OLD_DATA = "1";
process.env.BROWSERSLIST_DISABLE_CACHE = "1";

const cli = require.resolve("tailwindcss/lib/cli.js");
const input = path.join("src", "tailwind.css");
const output = path.join("src", "index.css");
const extra = process.argv
  .slice(2)
  .filter((arg) => arg !== "--watch" && arg !== "--watch=always");
const watching =
  process.argv.includes("--watch") || process.argv.includes("--watch=always");
const args = [cli, "-i", input, "-o", output, ...extra];

if (!watching) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  process.exit(result.status === null ? 1 : result.status);
}

let child = null;
let timer = null;
let building = false;
let queued = false;

function buildOnce() {
  return new Promise((resolve) => {
    child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("exit", (status, signal) => {
      child = null;
      resolve(signal ? 1 : status === null ? 1 : status);
    });
  });
}

async function rebuild() {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  do {
    queued = false;
    const status = await buildOnce();
    if (status !== 0) {
      console.error("css:watch: Tailwind build failed");
    }
  } while (queued);
  building = false;
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    rebuild();
  }, 100);
}

// Same sources tailwind.config.js scans. index.css is the output; rebuilding
// because it was just written loops forever.
const CONTENT = /\.(jsx?|tsx?|css|html)$/;

function relevant(root, filename) {
  if (!filename) {
    return false;
  }
  const rel = filename.split(path.sep).join("/");
  if (root === "src" && (rel === "index.css" || rel === "index.css.map")) {
    return false;
  }
  const base = rel.slice(rel.lastIndexOf("/") + 1);
  if (base.startsWith(".")) {
    return false;
  }
  return CONTENT.test(base);
}

function watchDir(root) {
  if (!fs.existsSync(root)) {
    return;
  }
  const watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
    if (relevant(root, filename)) {
      schedule();
    }
  });
  watcher.on("error", (error) => {
    console.error(`css:watch: ${root}: ${error.message}`);
  });
}

watchDir("src");
watchDir("public");
fs.watch(".", (_event, filename) => {
  if (filename === "tailwind.config.js") {
    schedule();
  }
});

if (!process.argv.includes("--watch=always")) {
  process.stdin.on("end", () => {
    if (child) {
      child.kill();
    }
    process.exit(0);
  });
  process.stdin.resume();
}

function shutdown() {
  clearTimeout(timer);
  if (child) {
    child.kill();
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

rebuild();
