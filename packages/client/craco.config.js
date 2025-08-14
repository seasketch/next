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
    configure: {
      resolve: {
        alias: {
          "polyclip-ts": path.resolve(
            __dirname,
            "../overlay-engine/node_modules/polyclip-ts/dist/cjs/index.cjs"
          ),
        },
      },
      module: {
        rules: [
          {
            test: /\.worker\.(js|ts)$/i,
            use: [
              {
                loader: "comlink-loader",
                options: {
                  singleton: true,
                },
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
          },
        ],
      },
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
