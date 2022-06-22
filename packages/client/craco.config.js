const crypto = require("crypto");
const fs = require("fs");
const GoogleFontsPlugin = require("@beyonk/google-fonts-webpack-plugin");
const WorkboxWebpackPlugin = require("workbox-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const fileBuffer = fs.readFileSync("./public/favicon.ico");
const hashSum = crypto.createHash("sha256");
hashSum.update(fileBuffer);

const hex = hashSum.digest("hex");

console.log("craco.config.js");
// craco.config.js
module.exports = {
  style: {
    postcss: {
      loaderOptions: (postcssLoaderOptions) => {
        postcssLoaderOptions.postcssOptions.plugins = [
          require("tailwindcss/nesting"),
          require("tailwindcss"),
          "postcss-flexbugs-fixes",
          [
            "postcss-preset-env",
            {
              autoprefixer: {
                flexbox: "no-2009",
              },
              stage: 0,
            },
          ],
        ];

        return postcssLoaderOptions;
      },
    },
  },
  webpack: {
    plugins: {
      add: [
        // Include in bundle for offline use
        new GoogleFontsPlugin({
          fonts: [{ family: "Inter", variants: ["400", "500", "600", "700"] }],
        }),
        // new WorkboxWebpackPlugin.InjectManifest({
        //   swSrc: path.resolve(__dirname, "src/service-worker.ts"),
        //   dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
        //   exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
        //   additionalManifestEntries: [{ url: "/favicon.ico", revision: hex }],
        //   maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        // }),
        // new BundleAnalyzerPlugin({ analyzerMode: "server" }),
      ],
      // remove: ["InjectManifest"],
    },
    configure: {
      optimization: {
        minimize: true,
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
        ],
      },
    },
  },
  eslint: {
    mode: "file",
  },
  babel: {
    loaderOptions: (babelLoaderOptions) => {
      babelLoaderOptions.ignore = [
        ...(babelLoaderOptions.ignore || []),
        "./node_modules/mapbox-gl/dist/mapbox-gl.js",
      ];
      return babelLoaderOptions;
    },
  },
};
