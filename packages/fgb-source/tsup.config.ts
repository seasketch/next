import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  // Declarations come from `tsc -b` (see tsconfig.json); clean: true would
  // delete them.
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: false,
  // Bundle all dependencies including ESM ones
  noExternal: ["flatgeobuf", "flatbuffers"],
  // Ensure proper handling of ESM imports
  esbuildOptions(options) {
    options.platform = "node";
    options.target = "node18";
  },
  treeshake: true,
});
