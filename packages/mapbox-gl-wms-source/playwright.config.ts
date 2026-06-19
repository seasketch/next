import { defineConfig, devices } from "@playwright/test";

/**
 * Two Playwright projects:
 *
 * - **mocked** (default): deterministic integration tests; all WMS traffic is
 *   intercepted from fixtures. Safe for blocking CI.
 *
 * - **live** (opt-in): hits real example WMS services for visual smoke and
 *   indicative CI. Run via `npm run test:e2e:live`. Intended as non-blocking.
 */
export default defineConfig({
  testDir: "./e2e/tests",
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5176",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite --config e2e/vite.config.ts",
    url: "http://localhost:5176/harness.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "mocked",
      testIgnore: "**/*.live.spec.ts",
      timeout: 30_000,
      fullyParallel: true,
      retries: process.env.CI ? 1 : 0,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--enable-unsafe-swiftshader",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--ignore-gpu-blocklist",
          ],
        },
      },
    },
    {
      name: "live",
      testMatch: "**/*.live.spec.ts",
      timeout: 90_000,
      fullyParallel: false,
      retries: process.env.CI ? 1 : 0,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--enable-unsafe-swiftshader",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--ignore-gpu-blocklist",
          ],
        },
      },
    },
  ],
});
