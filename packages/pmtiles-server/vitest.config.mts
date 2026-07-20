import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "workers",
          include: ["test/**/*.spec.ts", "test/**/*.test.ts"],
          exclude: ["test/dataTables/engine.test.ts", "test/dataTables/calculations.test.ts"],
        },
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.toml" },
          }),
        ],
      },
      {
        test: {
          name: "node-engine",
          environment: "node",
          include: [
            "test/dataTables/engine.test.ts",
            "test/dataTables/calculations.test.ts",
          ],
        },
      },
    ],
  },
});
