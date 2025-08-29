const WorkboxWebpackPlugin = require("workbox-webpack-plugin");

// craco.config.js
const path = require("path");
module.exports = {
  webpack: {
    plugins: {
      add: [
        new WorkboxWebpackPlugin.InjectManifest({
          swSrc: path.resolve(__dirname, "src/service-worker.ts"),
          dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
          exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
          additionalManifestEntries: [
            "/favicon.ico",
            "/fonts.css",
            "/tailwind-empty-vars-2.css",
            "/index.html",
            "/font/Inter-Regular.woff2",
            "/font/Inter-Regular.woff",
            "/font/Inter-Regular.ttf",
            "/font/Inter-Bold.woff2",
            "/font/Inter-Medium.woff2",
            "/font/Inter-Bold.woff",
            "/font/Inter-Medium.woff",
            "/font/Inter-Bold.ttf",
            "/font/Inter-Medium.ttf",
            "/font/Inter-SemiBold.woff2",
            "/font/Inter-SemiBold.woff",
            "/font/Inter-SemiBold.ttf",
            "/manifest.json",
          ],
          maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        }),
      ],
      remove: ["InjectManifest"],
    },
    configure: (config) => {
      // Alias
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        "polyclip-ts": path.resolve(
          __dirname,
          "../overlay-engine/node_modules/polyclip-ts/dist/cjs/index.cjs"
        ),
        // Shim for esm-env to work with Webpack 4 (no package exports conditions)
        "esm-env": path.resolve(__dirname, "src/shims/esm-env.ts"),
      };

      // Ensure .mjs is resolvable
      config.resolve.extensions = config.resolve.extensions || [
        ".mjs",
        ".js",
        ".json",
        ".jsx",
        ".ts",
        ".tsx",
      ];
      if (!config.resolve.extensions.includes(".mjs")) {
        config.resolve.extensions.push(".mjs");
      }

      // Extra rules
      config.module = config.module || { rules: [] };
      config.module.rules = config.module.rules || [];
      config.module.rules.push(
        {
          test: /\.worker\.(js|ts)$/i,
          use: [
            {
              loader: "comlink-loader",
              options: { singleton: true },
            },
          ],
        },
        {
          test: /\.wasm$/,
          type: "javascript/auto",
        },
        {
          test: /\.mjs/,
          include: /node_modules/,
          type: "javascript/auto",
        },
        {
          test: /\.cjs/,
          include: /node_modules/,
          type: "javascript/auto",
        }
      );

      // Transpile @number-flow packages with Babel
      const oneOfRule = config.module.rules.find((rule) =>
        Array.isArray(rule.oneOf)
      );
      if (oneOfRule) {
        const appBabelRule = oneOfRule.oneOf.find(
          (rule) =>
            rule.loader && rule.loader.includes("babel-loader") && rule.include
        );
        const depsBabelRuleIndex = oneOfRule.oneOf.findIndex(
          (rule) =>
            rule.loader && rule.loader.includes("babel-loader") && !rule.include
        );
        const includePaths = [];
        try {
          includePaths.push(
            path.dirname(require.resolve("@number-flow/react/package.json"))
          );
        } catch (e) {}
        try {
          includePaths.push(
            path.dirname(require.resolve("number-flow/package.json"))
          );
        } catch (e) {}
        try {
          includePaths.push(
            path.dirname(require.resolve("esm-env/package.json"))
          );
        } catch (e) {}
        if (appBabelRule && includePaths.length) {
          const customBabelRule = {
            test: /\.(js|mjs)$/,
            include: includePaths,
            loader: appBabelRule.loader,
            options: {
              ...(appBabelRule.options || {}),
              plugins: [
                ...((appBabelRule.options || {}).plugins || []),
                require.resolve("@babel/plugin-proposal-optional-chaining"),
                require.resolve(
                  "@babel/plugin-proposal-nullish-coalescing-operator"
                ),
                require.resolve(
                  "@babel/plugin-proposal-logical-assignment-operators"
                ),
              ],
            },
          };
          const insertIndex = depsBabelRuleIndex > -1 ? depsBabelRuleIndex : 0;
          oneOfRule.oneOf.splice(insertIndex, 0, customBabelRule);
        }
      }

      return config;
    },
  },
  eslint: {
    mode: "file",
  },
  babel: {
    loaderOptions: (babelLoaderOptions) => {
      const origBabelPresetCRAIndex = babelLoaderOptions.presets.findIndex(
        (preset) => {
          return preset[0].includes("babel-preset-react-app");
        }
      );

      const origBabelPresetCRA =
        babelLoaderOptions.presets[origBabelPresetCRAIndex];

      babelLoaderOptions.presets[origBabelPresetCRAIndex] =
        function overridenPresetCRA(api, opts, env) {
          const babelPresetCRAResult = require(origBabelPresetCRA[0])(
            api,
            origBabelPresetCRA[1],
            env
          );

          babelPresetCRAResult.presets.forEach((preset) => {
            // detect @babel/preset-react with {development: true, runtime: 'automatic'}
            const isReactPreset =
              preset &&
              preset[1] &&
              preset[1].runtime === "automatic" &&
              preset[1].development === true;
            if (isReactPreset) {
              preset[1].importSource = "@welldone-software/why-did-you-render";
            }
          });

          return babelPresetCRAResult;
        };
      babelLoaderOptions.ignore = [
        "./node_modules/mapbox-gl/dist/mapbox-gl.js",
        // "./node_modules/d3-scale-chromatic",
        "./node_modules/@observablehq/plot",
        "./node_modules/@observablehq/plot/src/marks/raster.js",
        "./node_modules/@observablehq/plot/**/*",
      ];
      // Ensure transform of modern syntax for Webpack 4 parser
      babelLoaderOptions.plugins = [
        ...(babelLoaderOptions.plugins || []),
        require.resolve("@babel/plugin-proposal-optional-chaining"),
        require.resolve("@babel/plugin-proposal-nullish-coalescing-operator"),
        require.resolve("@babel/plugin-proposal-logical-assignment-operators"),
      ];
      return babelLoaderOptions;
    },
  },
  jest: {
    configure: {
      moduleNameMapper: {
        "mapbox-gl/dist/style-spec/index.es.js":
          "mapbox-gl/dist/style-spec/index.cjs",
      },
    },
  },
};
