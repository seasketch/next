// rollup.config.js
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import cleanup from "rollup-plugin-cleanup";
export default {
  input: "dist/index.js",
  output: {
    file: "dist/bundle.js",
    format: "iife",
    name: "MapBoxGLEsriSources",
  },
  plugins: [resolve({ browser: true }), commonjs({ browser: true }), cleanup()],
};
