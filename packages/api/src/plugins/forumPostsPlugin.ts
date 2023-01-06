import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { DOMSerializer, Fragment, Node } from "prosemirror-model";
import { forums } from "../prosemirror/config";
import { JSDOM } from "jsdom";

const ForumPostsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Mutation {
        createPost(topicId: Int!, message: JSON!): Post!
        createTopic(forumId: Int!, message: JSON!, title: String!): Topic!
      }
    `,
    resolvers: {
      Mutation: {
        createPost: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          if (!args.message) {
            throw new Error("message not present");
          }
          const html = messageToHTML(args.message);
          const r = await pgClient.query(
            `select id from create_post($1, $2, $3)`,
            [args.message, args.topicId, html]
          );
          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`public.posts`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(r.rows[0].id)}`
              );
            }
          );
          return row;
        },
        createTopic: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          if (!args.message) {
            throw new Error("message not present");
          }
          const html = messageToHTML(args.message);
          const r = await pgClient.query(
            `select id from create_topic($1, $2, $3, $4)`,
            [args.forumId, args.title, args.message, html]
          );
          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`public.topics`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(r.rows[0].id)}`
              );
            }
          );
          return row;
        },
      },
    },
  };
});

export function messageToHTML(content: Fragment) {
  try {
    const dom = new JSDOM(
      `<!DOCTYPE html><body><div id="target"></div></body></html>`
    );
    const target = dom.window.document.getElementById("target")!;
    const options = { document: dom.window.document };
    let contentNode = Node.fromJSON(forums, content);
    DOMSerializer.fromSchema(forums).serializeFragment(
      contentNode.content,
      options,
      target
    );
    return target.innerHTML;
  } catch (e) {
    return `<code>${(e as Error).message}</code>`;
  }
}

export default ForumPostsPlugin;
