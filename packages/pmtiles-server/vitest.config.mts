import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Pure unit tests for the data-table query engine run in plain node (no
// workerd), which allows fixture file access and faster startup.
const NODE_TESTS = [
  "test/dataTables/engine.test.ts",
  "test/dataTables/calculations.test.ts",
  "test/dataTables/params.test.ts",
  "test/dataTables/blockReader.test.ts",
];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "workers",
          include: ["test/**/*.spec.ts", "test/**/*.test.ts"],
          exclude: NODE_TESTS,
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
          include: NODE_TESTS,
        },
      },
    ],
  },
});
