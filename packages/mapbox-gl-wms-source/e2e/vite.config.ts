import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: __dirname,
  // Load VITE_MAPBOX_TOKEN from the package root .env (Mapbox GL requires a
  // valid token to render, even with an inline style).
  envDir: path.resolve(__dirname, ".."),
  resolve: {
    alias: {
      // metadata.ts dynamically imports this; resolve to the built CJS bundle.
      "@seasketch/metadata-parser": path.resolve(
        __dirname,
        "../../metadata-parser/dist/metadata-parser.js"
      ),
    },
  },
  server: {
    port: 5176,
    strictPort: true,
  },
});
