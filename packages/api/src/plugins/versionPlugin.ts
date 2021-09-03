import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { version } from "../../package.json";

const VersionPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      extend type Query {
        """
        GraphQL server software version
        """
        version: String!
        """
        Reference to release in source control
        """
        sha: String
      }
    `,
    resolvers: {
      Query: {
        version: async (parent, args, context, info) => {
          return version;
        },
        sha: async (parent, args, context, info) => {
          return process.env.GIT_SHA;
        },
      },
    },
  };
});

export default VersionPlugin;
