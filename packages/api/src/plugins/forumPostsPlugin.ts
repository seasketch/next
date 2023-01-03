import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { DOMSerializer } from "prosemirror-model";
import { forums } from "../prosemirror/config";

const ForumPostsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Post {
        """
        HTML rendered from the prosemirror message_content document
        """
        messageHTML: String! @requires(columns: ["message_contents"])
      }
    `,
    resolvers: {
      Post: {
        messageHTML: async (post, args, context, resolveInfo) => {
          const doc = post.messageContents;
          console.log("args", args, post, forums, doc);
          const html = DOMSerializer.fromSchema(forums).serializeFragment(
            doc.content
          );
          return html || "<code>hi!</code>";
        },
      },
    },
  };
});

export default ForumPostsPlugin;
