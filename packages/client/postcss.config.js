// PostCSS 8 is not support by CRA yet so we can't use the jit just yet
// https://github.com/facebook/create-react-app/issues/9664
// https://github.com/tailwindlabs/tailwindcss-jit
// module.exports = {
//   plugins: { "@tailwindcss/jit": {}, autoprefixer: {} },
// };
// In the meantime, use this config:
// postcss.config.js
module.exports = {
  plugins: {
    '@tailwindcss/jit': {},
    autoprefixer: {},
  }
}
