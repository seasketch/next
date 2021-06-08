/** Note that this only applies to  */
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["react-app"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint", "i18next"],
  ignorePatterns: ["**/generated/*.ts", "**/*.stories.*"],
  rules: {
    "i18next/no-literal-string": [
      2,
      {
        ignore: ["SeaSketch", "Error:"],
        ignoreCallee: [
          "useTranslation",
          "t",
          "Route",
          "history.replace",
          "client.writeFragment",
          "gql",
          "cache.writeFragment",
        ],
        onlyAttribute: ["label", "title", "description", "footer"],
        ignoreProperty: ["href", "className"],
        validateTemplate: true,
      },
    ],
    "no-console": [
      process.env.NODE_ENV === "production" ? 2 : 1,
      { allow: ["warn", "error"] },
    ],
  },
};
