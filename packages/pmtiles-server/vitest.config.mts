import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Pure unit tests for the data-table query engine run in plain node (no
// workerd), which allows fixture file access and faster startup.
const NODE_TESTS = [
  "test/dataTables/engine.test.ts",
  "test/dataTables/calculations.test.ts",
  "test/dataTables/params.test.ts",
  "test/dataTables/blockReader.test.ts",
  "test/dataTables/temporalPreview.test.ts",
  "test/dataTables/rawAggConsistency.test.ts",
  "test/dataTables/replicateMode.test.ts",
  "test/dataTables/monitoringUseCases.test.ts",
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
            miniflare: {
              // The real overlay-data-tables Worker is a separate isolate in
              // production. Tests stub the service binding so routing/auth
              // stay in this pool without bundling hyparquet into SELF.
              serviceBindings: {
                DATA_TABLES: (request: Request) => {
                  const url = new URL(request.url);
                  return new Response(
                    JSON.stringify({
                      stub: "overlay-data-tables",
                      pathname: url.pathname,
                      search: url.search,
                      authorization: request.headers.get("Authorization"),
                    }),
                    { headers: { "Content-Type": "application/json" } }
                  );
                },
              },
            },
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
