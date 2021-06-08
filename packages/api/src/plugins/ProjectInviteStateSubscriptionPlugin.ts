import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";

const projectInviteStateTopicFromContext = async (_args: any, context: any) => {
  if (context.projectId) {
    return `graphql:project:${context.projectId}:project_invite_status_change`;
  } else {
    throw new Error("You must specify a project");
  }
};

const plugin = makeExtendSchemaPlugin(({ pgSql: sql }) => ({
  typeDefs: gql`
    type ProjectInviteStateSubscriptionPayload {
      invite: ProjectInvite
    }

    extend type Subscription {
      """
      Triggered when the status of a project invite changes, generally because
      of a change in the delivery status of a related InviteEmail. Uses 
      x-ss-slug to determine appropriate project.
      """
      projectInviteStateUpdated: ProjectInviteStateSubscriptionPayload @pgSubscription(topic: ${embed(
        projectInviteStateTopicFromContext
      )})
    }
  `,

  resolvers: {
    ProjectInviteStateSubscriptionPayload: {
      async invite(
        event,
        _args,
        _context,
        { graphile: { selectGraphQLResultFromTable } }
      ) {
        const rows = await selectGraphQLResultFromTable(
          sql.fragment`project_invites`,
          (tableAlias, sqlBuilder) => {
            return sqlBuilder.where(
              sql.fragment`${tableAlias}.id = ${sql.value(
                parseInt(event.inviteId)
              )}`
            );
          }
        );
        return rows[0];
      },
    },
  },
}));

export default plugin;
