import path from "path";
import { defineConfig, devices } from "@playwright/test";

const apiDir = path.resolve(__dirname, "../api");
const clientDir = path.resolve(__dirname, "../client");

/**
 * Headless is the default (`npm run e2e`).
 * `--headed` shows the browser while the tests run.
 * `--ui` opens Playwright's interactive runner: pick a test, watch it, and
 * step back through actions, the DOM, console, and network.
 *
 * Locally, an API or client that is already listening is reused. The API must
 * have been started with packages/e2e/e2e.env, or /e2e/token will 404. CI
 * always starts both.
 */
const ci = !!process.env.CI;

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
    baseURL: process.env.E2E_CLIENT_URL || "http://localhost:3000",
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
  webServer: [
    {
      command: "set -a && . ../e2e/e2e.env && set +a && npm run dev",
      cwd: apiDir,
      url: "http://127.0.0.1:3857/graphiql",
      reuseExistingServer: !ci,
      timeout: 120_000,
    },
    {
      command: "BROWSER=none npm start",
      cwd: clientDir,
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !ci,
      timeout: ci ? 360_000 : 180_000,
    },
  ],
});
