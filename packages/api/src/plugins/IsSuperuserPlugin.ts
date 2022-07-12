import { makeExtendSchemaPlugin, gql } from "graphile-utils";

const IsSuperuserPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Query {
        currentUserIsSuperuser: Boolean!
      }
    `,
    resolvers: {
      Query: {
        currentUserIsSuperuser: async (_query, args, context, resolveInfo) => {
          return !!(
            context.user && context.user["https://seasketch.org/superuser"]
          );
        },
      },
    },
  };
});

export default IsSuperuserPlugin;
