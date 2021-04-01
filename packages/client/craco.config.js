// craco.config.js
module.exports = {
  style: {
    postcss: {
      plugins: [require("tailwindcss"), require("autoprefixer")],
    },
  },
  webpack: {
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
        ],
      },
    },
  },
  eslint: {
    mode: "file",
  },
  babel: {
    loaderOptions: {
      ignore: ["./node_modules/mapbox-gl/dist/mapbox-gl.js"],
    },
  },
};
