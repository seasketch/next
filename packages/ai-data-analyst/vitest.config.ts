import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, packageDir, "");
  return {
    test: {
      environment: "node",
      include: ["__tests__/**/*.test.ts"],
      env,
    },
  };
});
