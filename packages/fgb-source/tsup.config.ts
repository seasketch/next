import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Bundle all dependencies including ESM ones
  noExternal: ["flatgeobuf"],
  // Ensure proper handling of ESM imports
  esbuildOptions(options) {
    options.platform = "node";
  },
  treeshake: true,
});
