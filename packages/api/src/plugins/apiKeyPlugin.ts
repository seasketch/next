import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { createApiKey } from "../apiKeys";

const ApiKeyPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      type CreateApiKeyResponse {
        token: String!
      }

      extend type Mutation {
        createApiKey(
          projectId: Int!
          label: String!
          ttlMs: Int
        ): CreateApiKeyResponse!
      }
    `,
    resolvers: {
      Mutation: {
        createApiKey: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          console.log({ context });
          const { projectId, label, ttlMs } = args;
          const token = await createApiKey(
            label,
            projectId,
            context.user.id,
            context.adminPool,
            ttlMs / 1000
          );
          return { token };
        },
      },
    },
  };
});

export default ApiKeyPlugin;
