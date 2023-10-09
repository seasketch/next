import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";

const messageIdFromContext = async (args: any, context: any) => {
  if (args.slug) {
    return `graphql:project:${args.slug}:toc_draft_changed`;
  } else {
    throw new Error("You must specify a project id");
  }
};

const DraftTocStatusPlugin = makeExtendSchemaPlugin(({ pgSql: sql }) => ({
  typeDefs: gql`
    type ProjectDraftTableOfContentsStatusPayload {
      projectId: Int!
      hasChanges: Boolean!
      project: Project
    }

    extend type Subscription {
      """
      Triggered when a project's draft table of contents status changes
      """
      updatedDraftTableOfContentsStatus(slug: String!): ProjectDraftTableOfContentsStatusPayload @pgSubscription(topic: ${embed(
        messageIdFromContext
      )})
    }
  `,

  resolvers: {
    ProjectDraftTableOfContentsStatusPayload: {
      async project(
        event,
        args,
        _context,
        { graphile: { selectGraphQLResultFromTable } }
      ) {
        const rows = await selectGraphQLResultFromTable(
          sql.fragment`projects`,
          (tableAlias, sqlBuilder) => {
            return sqlBuilder.where(
              sql.fragment`${tableAlias}.id = ${sql.value(event.projectId)}`
            );
          }
        );
        return rows[0];
      },
    },
  },
}));

export default DraftTocStatusPlugin;
