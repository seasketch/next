import { defineConfig, loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const useProxy = env.VITE_WMS_PROXY === "1";
  return {
    root: __dirname,
    envDir: path.resolve(__dirname, ".."),
    resolve: {
      alias: {
        "@seasketch/mapbox-gl-wms-source": path.resolve(__dirname, "../index.ts"),
        "@seasketch/metadata-parser": path.resolve(
          __dirname,
          "../../metadata-parser/dist/metadata-parser.js"
        ),
      },
    },
    server: {
      port: 5175,
      proxy: useProxy
        ? {
            "/wms-proxy": {
              target: "https://wms.gebco.net",
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/wms-proxy/, ""),
            },
          }
        : undefined,
    },
  };
});
