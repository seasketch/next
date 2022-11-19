/** Note that this only applies to  */
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["react-app", "plugin:cypress/recommended"],
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
          "questionBodyFromMarkdown",
          "console.log",
          "console.warn",
          "console.error",
          "Error",
          "fetch",
          "useRouteMatch",
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
  overrides: [
    {
      files: ["*.spec.js", "*.spec.ts", "cypress/**/*.js"],
      rules: {
        "i18next/no-literal-string": "off",
      },
    },
  ],
};
