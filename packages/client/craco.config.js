console.log("craco config");
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
};
