import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Bundle all dependencies including ESM ones
  noExternal: ["flatgeobuf", "flatbuffers"],
  // Ensure proper handling of ESM imports
  esbuildOptions(options) {
    options.platform = "node";
    options.target = "node18";
  },
  treeshake: true,
});
