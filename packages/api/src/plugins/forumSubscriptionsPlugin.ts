import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";

const postNotificationTopicFromContext = async (args: any, context: any) => {
  if (args.slug) {
    return `graphql:project:${args.slug}:forumActivity`;
  } else {
    throw new Error("You must specify project slug");
  }
};

const ForumSubscriptionsPlugin = makeExtendSchemaPlugin(({ pgSql: sql }) => ({
  typeDefs: gql`
    type ForumActivityPayload {
      postId: Int!
      topicId: Int!
      forumId: Int!
      projectId: Int!
      post: Post
      topic: Topic
      forum: Forum
      project: Project
    }

    extend type Subscription {
      """
      Triggered when a new post is created in the subscribed topic
      """
      forumActivity(slug: String!): ForumActivityPayload @pgSubscription(topic: ${embed(
        postNotificationTopicFromContext
      )})
    }
  `,

  resolvers: {
    ForumActivityPayload: {
      async post(
        event,
        args,
        _context,
        { graphile: { selectGraphQLResultFromTable } }
      ) {
        const rows = await selectGraphQLResultFromTable(
          sql.fragment`posts`,
          (tableAlias, sqlBuilder) => {
            return sqlBuilder.where(
              sql.fragment`${tableAlias}.id = ${sql.value(
                parseInt(event.postId)
              )}`
            );
          }
        );
        return rows[0];
      },
      async topic(
        event,
        args,
        _context,
        { graphile: { selectGraphQLResultFromTable } }
      ) {
        const rows = await selectGraphQLResultFromTable(
          sql.fragment`topics`,
          (tableAlias, sqlBuilder) => {
            return sqlBuilder.where(
              sql.fragment`${tableAlias}.id = ${sql.value(
                parseInt(event.topicId)
              )}`
            );
          }
        );
        return rows[0];
      },
      async forum(
        event,
        args,
        _context,
        { graphile: { selectGraphQLResultFromTable } }
      ) {
        const rows = await selectGraphQLResultFromTable(
          sql.fragment`forums`,
          (tableAlias, sqlBuilder) => {
            return sqlBuilder.where(
              sql.fragment`${tableAlias}.id = ${sql.value(
                parseInt(event.forumId)
              )}`
            );
          }
        );
        return rows[0];
      },
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
              sql.fragment`${tableAlias}.id = ${sql.value(
                parseInt(event.projectId)
              )}`
            );
          }
        );
        return rows[0];
      },
    },
  },
}));

export default ForumSubscriptionsPlugin;
