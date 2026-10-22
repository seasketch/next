#!/usr/bin/env node
// Restore seasketch_e2e from the golden snapshot, then run Playwright.
// The dev database is not touched. Playwright starts its own API and client.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { e2eStack } from "./dev.config.mjs";
import { assertPlaywrightChromium } from "./ensure-playwright-browser.mjs";

assertPlaywrightChromium();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (e2eStack.database === "seasketch") {
  console.error("e2e refuses to reset the dev database.");
  process.exit(1);
}

function run(command, args, env, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited ${code === null ? signal : code}`
          )
        );
      }
    });
  });
}

const databaseEnv = {
  SEASKETCH_DB_NAME: e2eStack.database,
  SEASKETCH_REDIS_DB: String(e2eStack.redisDb),
  DATABASE_URL: e2eStack.databaseUrl("graphile"),
  ADMIN_DATABASE_URL: e2eStack.databaseUrl("postgres"),
};

try {
  await run("npm", ["run", "build", "--silent"]);
  await run("npm", ["run", "setup", "--", "--reset"], databaseEnv);
  const playwrightArgs = process.argv.slice(2);
  const npmArgs = ["test", "--workspace", "@seasketch/e2e"];
  if (playwrightArgs.length > 0) {
    npmArgs.push("--", ...playwrightArgs);
  }
  await run(
    "npm",
    npmArgs,
    {
      ...databaseEnv,
      E2E_PROFILE: "e2e",
      E2E_API_URL: `http://localhost:${e2eStack.apiPort}`,
      E2E_CLIENT_URL: `http://localhost:${e2eStack.clientPort}`,
      REDIS_DB: String(e2eStack.redisDb),
      CLIENT_DOMAIN: `localhost:${e2eStack.clientPort}`,
      REACT_APP_GRAPHQL_ENDPOINT: `http://localhost:${e2eStack.apiPort}/graphql`,
    }
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
