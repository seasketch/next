import { defineConfig } from "vitest/config";

// Engine logic (param parsing, planning/pruning, filtering, aggregation) is
// plain TypeScript and is tested directly in Node against the real parquet
// fixture. The thin Cloudflare layer (R2 binding, caches.default) is
// exercised via `wrangler dev`.
export default defineConfig({
  test: {
    environment: "node",
  },
});
