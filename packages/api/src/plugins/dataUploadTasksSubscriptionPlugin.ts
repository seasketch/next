import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";

const notificationTopicFromContext = async (args: any, context: any) => {
  if (args.slug) {
    return `graphql:project:${args.slug}:dataUploadTasks`;
  } else {
    throw new Error("You must specify project slug");
  }
};

const DataUploadTasksSubscriptionPlugin = makeExtendSchemaPlugin(
  ({ pgSql: sql }) => ({
    typeDefs: gql`
    type DataUploadTaskSubscriptionPayload {
      projectId: Int!
      project: Project!,
      dataUploadTaskId: UUID!
      dataUploadTask: DataUploadTask
      previousState: DataUploadState
    }

    extend type Subscription {
      """
      Triggered on all updates to DataUploadTasks in a project
      """
      dataUploadTasks(slug: String!): DataUploadTaskSubscriptionPayload @pgSubscription(topic: ${embed(
        notificationTopicFromContext
      )})
    }
  `,

    resolvers: {
      DataUploadTaskSubscriptionPayload: {
        async dataUploadTask(
          event,
          args,
          _context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          try {
            const rows = await selectGraphQLResultFromTable(
              sql.fragment`public.data_upload_tasks`,
              (tableAlias, sqlBuilder) => {
                return sqlBuilder.where(
                  sql.fragment`${tableAlias}.id = ${sql.value(
                    event.dataUploadTaskId
                  )}`
                );
              }
            );
            return rows[0];
          } catch (e) {
            console.error(e);
            throw e;
          }
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
  })
);

export default DataUploadTasksSubscriptionPlugin;
