import fs from "fs";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

const repoRoot = path.resolve(__dirname, "../..");

/**
 * Headless is the default (`npm run e2e`).
 * `--headed` shows the browser while the tests run.
 * `--ui` opens Playwright's interactive runner: pick a test, watch it, and
 * step back through actions, the DOM, console, and network.
 *
 * webServer runs `npm run dev -- --ci --profile e2e`. That profile is the API
 * and client on ports 13857 and 13000, with DATABASE_URL pointed at
 * seasketch_e2e. `npm run e2e` restores that database first. The dev server
 * on port 3000 is never reused.
 * E2E_TEST_MODE and the passphrase come from e2e.env, passed here.
 */
const ci = !!process.env.CI;

function parseDotenv(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function webServerEnv(): { [key: string]: string } {
  const env: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return { ...env, ...parseDotenv(path.resolve(__dirname, "e2e.env")) };
}

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci
    ? [
        ["list"],
        ["html", { open: "never" }],
        ["junit", { outputFile: "junit.xml" }],
        ["github"],
      ]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_CLIENT_URL || "http://localhost:13000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: ci ? "retain-on-failure" : "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --ci --profile ${process.env.E2E_PROFILE || "e2e"}`,
    cwd: repoRoot,
    // The e2e client starts after the e2e API answers on 13857.
    url: "http://127.0.0.1:13000",
    reuseExistingServer: false,
    // Covers the subdivision image build plus the client dev server.
    timeout: ci ? 900_000 : 180_000,
    // Show both streams. The default hides stdout, so a supervisor that logs
    // there exits in CI with no reason attached.
    stdout: "pipe",
    stderr: "pipe",
    env: webServerEnv(),
  },
});
