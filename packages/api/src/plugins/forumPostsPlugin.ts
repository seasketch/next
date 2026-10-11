import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { DOMSerializer, Fragment, Node } from "prosemirror-model";
import { forums } from "../prosemirror/config";
import { JSDOM } from "jsdom";

/** Keep in sync with topics.titlechk and client topicTitle.ts. */
const TOPIC_TITLE_MAX_LENGTH = 80;

function topicTitleCharLength(title: string): number {
  return Array.from(title).length;
}

/**
 * Reject titles the database would refuse, with a message end users can read.
 * `char_length` counts Unicode code points, same as Array.from.
 */
function assertTopicTitle(title: unknown): asserts title is string {
  if (typeof title !== "string") {
    throw new Error("Enter a topic title.");
  }
  const length = topicTitleCharLength(title);
  if (length > TOPIC_TITLE_MAX_LENGTH) {
    throw new Error(
      `Titles must be ${TOPIC_TITLE_MAX_LENGTH} characters or fewer. This title is ${length} characters.`
    );
  }
  if (title.trim().length === 0) {
    throw new Error("Enter a topic title.");
  }
}

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
          assertTopicTitle(args.title);
          if (!args.message) {
            throw new Error("Write a message before posting.");
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
    console.error(e);
    return `<code>${(e as Error).message}</code>`;
  }
}

export default ForumPostsPlugin;
