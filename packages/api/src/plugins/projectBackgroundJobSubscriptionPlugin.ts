import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";

const notificationTopicFromContext = async (args: any, context: any) => {
  if (args.slug) {
    console.log(`graphql:project:${args.slug}:projectBackgroundJobs`);
    return `graphql:project:${args.slug}:projectBackgroundJobs`;
  } else {
    throw new Error("You must specify project slug");
  }
};

const ProjectBackgroundJobSubscriptionPlugin = makeExtendSchemaPlugin(
  ({ pgSql: sql }) => ({
    typeDefs: gql`
    type ProjectBackgroundJobSubscriptionPayload {
      projectId: Int!
      project: Project!
      id: UUID!
      job: ProjectBackgroundJob
      previousState: ProjectBackgroundJobState
    }

    extend type Subscription {
      """
      Triggered on all updates to DataUploadTasks in a project
      """
      backgroundJobs(slug: String!): ProjectBackgroundJobSubscriptionPayload @pgSubscription(topic: ${embed(
        notificationTopicFromContext
      )})
    }
  `,

    resolvers: {
      ProjectBackgroundJobSubscriptionPayload: {
        async job(
          event,
          args,
          _context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          try {
            const rows = await selectGraphQLResultFromTable(
              sql.fragment`public.project_background_jobs`,
              (tableAlias, sqlBuilder) => {
                return sqlBuilder.where(
                  sql.fragment`${tableAlias}.id = ${sql.value(event.id)}`
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

export default ProjectBackgroundJobSubscriptionPlugin;
