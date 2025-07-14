import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    globals: true,
    environment: "node",
    reporters: ["default"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
    },
  },
});
