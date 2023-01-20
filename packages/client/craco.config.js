const WorkboxWebpackPlugin = require("workbox-webpack-plugin");

// craco.config.js
const path = require("path");
module.exports = {
  style: {
    postcss: {
      plugins: [require("tailwindcss"), require("autoprefixer")],
    },
  },
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
            "/index.html",
          ],
          maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        }),
      ],
      remove: ["InjectManifest"],
    },
    configure: {
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
      ];
      return babelLoaderOptions;
    },
  },
};
