import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { getHostedTileUuidsRequiringAuth } from "../tilesAcl/hostedTileUuidsRequiringAuth";

/**
 * Project.hostedTileUuidsRequiringAuth — UUIDs for SeaSketch-hosted overlays
 * that must send mapAccessToken on hosted tiles/uploads requests.
 *
 * Computed in Node (no SQL migration): reuses published ACL-doc public[] and
 * subtracts that from hosted UUIDs on published (+ draft for admins) TOC items.
 */
const HostedTileUuidsRequiringAuthPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      extend type Project {
        """
        Content-addressed tileset UUIDs whose hosted tiles/uploads requests
        must include a map access token. Equals hosted UUIDs from published
        TOC items (and draft TOC items for project admins) that are not in the
        published ACL document's public list. Empty for projects with no
        protected overlays.
        """
        hostedTileUuidsRequiringAuth: [String!]!
          @requires(columns: ["id"])
      }
    `,
    resolvers: {
      Project: {
        hostedTileUuidsRequiringAuth: async (project, _args, context) => {
          const projectId = project.id as number | undefined;
          if (!projectId) {
            return [];
          }
          // session_is_admin must run on the request client (JWT/session GUC).
          // adminPool has no user session, so it would always report false and
          // omit draft-only hosted UUIDs from the auth list.
          const { pgClient, adminPool } = context;
          if (!pgClient && !adminPool) {
            return [];
          }

          let includeDraft = false;
          if (pgClient) {
            try {
              const adminResult = await pgClient.query(
                `select session_is_admin($1::int) as is_admin`,
                [projectId]
              );
              includeDraft = Boolean(adminResult.rows[0]?.is_admin);
            } catch {
              includeDraft = false;
            }
          }

          return getHostedTileUuidsRequiringAuth(adminPool || pgClient, projectId, {
            includeDraft,
          });
        },
      },
    },
  };
});

export default HostedTileUuidsRequiringAuthPlugin;
