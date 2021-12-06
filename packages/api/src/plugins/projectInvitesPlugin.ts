import { postgraphile } from "postgraphile";
import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import {
  verifyProjectInvite,
  confirmProjectInvite,
} from "../invites/projectInvites";

const HOST = process.env.HOST || "seasketch.org";

const ProjectInvitesPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      type ProjectInviteTokenClaims {
        projectId: Int!
        inviteId: Int!
        admin: Boolean!
        fullname: String
        email: String!
        wasUsed: Boolean!
        projectName: String!
        projectSlug: String!
      }

      type ProjectInviteTokenVerificationResults {
        error: String
        claims: ProjectInviteTokenClaims
        """
        Indicates whether there is an existing account that matches the email address on the invite
        """
        existingAccount: Boolean
      }

      extend type Query {
        """
        Verify whether the an invite token has a valid signature and has not yet
        expired.

        Use before attempting the confirmProjectInvite() mutation.
        More details on how to handle invites can be found
        [on the wiki](https://github.com/seasketch/next/wiki/User-Ingress#project-invites)
        """
        verifyProjectInvite(
          """
          JWT string
          """
          token: String!
        ): ProjectInviteTokenVerificationResults
      }

      extend type Mutation {
        """
        Accept a project invite using a token (distributed via email). When
        confirming a token, the current session will be assigned any group
        membership or admin privileges assigned to the invite. The act of
        accepting a token that was sent via email will also verify the user's
        email if it wasn't already.

        More details on how to handle invites can be found
        [on the wiki](https://github.com/seasketch/next/wiki/User-Ingress#project-invites)
        """
        confirmProjectInvite(
          """
          JWT string
          """
          token: String!
        ): ProjectInviteTokenClaims
      }
    `,
    resolvers: {
      Mutation: {
        confirmProjectInvite: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          const claims = await confirmProjectInvite(pgClient, args.token, HOST);
          return {
            ...claims,
          };
        },
      },
      Query: {
        verifyProjectInvite: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          try {
            const claims = await verifyProjectInvite(
              pgClient,
              args.token,
              HOST
            );
            const { rows } = await context.pgClient.query(
              `select account_exists($1)`,
              [claims.email]
            );
            return {
              claims,
              existingAccount: rows[0].account_exists,
            };
          } catch (e: any) {
            return {
              error: e.message,
            };
          }
        },
      },
    },
  };
});

export default ProjectInvitesPlugin;
