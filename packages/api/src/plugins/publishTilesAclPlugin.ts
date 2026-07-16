import { makeWrapResolversPlugin } from "postgraphile";
import { writeProjectAclDocToR2 } from "../tilesAcl/writeProjectAclDoc";

/**
 * After publishTableOfContents succeeds, write the project's tile ACL document
 * to R2 before returning to the client.
 *
 * Important: use context.pgClient (same transaction as the mutation), not
 * adminPool. adminPool is a different connection and cannot see the just-
 * published TOC until this GraphQL transaction commits — so it would write a
 * stale ACL doc (the failure mode backfill "fixes").
 */
const PublishTilesAclPlugin = makeWrapResolversPlugin({
  Mutation: {
    publishTableOfContents: async (
      resolve,
      source,
      args,
      context,
      resolveInfo
    ) => {
      const result = await resolve(source, args, context, resolveInfo);
      const projectId =
        args?.input?.projectId ?? args?.projectId ?? null;
      if (projectId != null && process.env.NODE_ENV !== "test") {
        try {
          const pgClient = context.pgClient;
          if (!pgClient) {
            throw new Error(
              "publishTableOfContents: pgClient required to write tiles ACL"
            );
          }
          const { ns, key, doc } = await writeProjectAclDocToR2(
            pgClient,
            projectId
          );
          console.log(
            JSON.stringify({
              msg: "tiles-acl-written",
              projectId,
              ns,
              key,
              public: doc.public.length,
              protected: Object.keys(doc.protected).length,
            })
          );
        } catch (e: any) {
          console.error(
            JSON.stringify({
              msg: "tiles-acl-write-failed",
              projectId,
              error: e?.message || String(e),
            })
          );
          // Surface failure: ACL must be present before clients see published TOC
          throw e;
        }
      }
      return result;
    },
  },
});

export default PublishTilesAclPlugin;
