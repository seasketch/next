module.exports = {
  client: {
    service: {
      name: "seasketch",
      localSchemaFile: "./packages/api/generated-schema.gql",
    },
    includes: [
      "./packages/client/src/**/*.js",
      "./packages/client/src/**/*.jsx",
      "./packages/client/src/*.ts",
      "./packages/client/src/**/*.tsx",
      "./packages/client/src/queries/*.graphql",
    ],
    excludes: ["./src/generated/*"],
  },
};
