import { makeExtendSchemaPlugin, gql } from "graphile-utils";
const { BUILD } = process.env;

const BuildPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      extend type Query {
        """
        GraphQL server software build identifier. During a deployment, if changes are not detected in software modules some may be skipped. So, client and server version could differ.

        We return "dev" if build cannot be determined from deployment environment.
        """
        build: String!
      }
    `,
    resolvers: {
      Query: {
        build: async (parent, args, context, info) => {
          return BUILD || "dev";
        },
      },
    },
  };
});

export default BuildPlugin;
