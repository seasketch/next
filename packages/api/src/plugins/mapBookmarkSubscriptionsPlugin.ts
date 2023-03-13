import { makeExtendSchemaPlugin, gql, embed } from "graphile-utils";

const bookmarkTopicFromContext = async (args: any, context: any) => {
  if (args.id) {
    return `graphql:mapBookmark:${args.id}:update`;
  } else {
    throw new Error("You must specify a bookmark id");
  }
};

const MapBookmarkSubscriptionsPlugin = makeExtendSchemaPlugin(
  ({ pgSql: sql }) => ({
    typeDefs: gql`
    type BookmarkPayload {
      bookmarkId: UUID!
      bookmark: MapBookmark
    }

    extend type Subscription {
      """
      Triggered when a map bookmark is updated
      """
      updatedMapBookmark(id: UUID!): BookmarkPayload @pgSubscription(topic: ${embed(
        bookmarkTopicFromContext
      )})
    }
  `,

    resolvers: {
      BookmarkPayload: {
        async bookmark(
          event,
          args,
          _context,
          { graphile: { selectGraphQLResultFromTable } }
        ) {
          const rows = await selectGraphQLResultFromTable(
            sql.fragment`map_bookmarks`,
            (tableAlias, sqlBuilder) => {
              return sqlBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(event.bookmarkId)}`
              );
            }
          );
          return rows[0];
        },
      },
    },
  })
);

export default MapBookmarkSubscriptionsPlugin;
