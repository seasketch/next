import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    globals: true,
    environment: "node",
    setupFiles: ["./__tests__/setupFetch.ts"],
    reporters: ["default"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
    },
  },
});
