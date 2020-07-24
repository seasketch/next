const {
  makeAddPgTableOrderByPlugin,
  createPostGraphQLSchema,
  orderByAscDesc,
} = require("postgraphile");

// TODO: I'm not certain the ordering logic here is correct. Will have to check
// later but the gist is here.
module.exports = makeAddPgTableOrderByPlugin(
  "public",
  "topics",
  // @ts-ignore
  (build) => {
    const sqlIdentifier = build.pgSql.identifier(Symbol("lastPostInTopic"));
    return {
      LAST_POST_CREATED_AT_AND_STICKY: {
        value: {
          specs: [
            ["sticky", false],
            [
              // @ts-ignore
              ({ queryBuilder }) => build.pgSql.fragment`(
              select ${sqlIdentifier}.created_at
              from public.posts as ${sqlIdentifier}
              where ${sqlIdentifier}.topic_id = ${queryBuilder.getTableAlias()}.id
              order by ${sqlIdentifier}.created_at desc
              limit 1
            )`,
              false,
            ],
          ],
          unique: true,
        },
      },
    };
  }
);
