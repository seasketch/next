import { postgraphile } from "postgraphile";
import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import {
  verifySurveyInvite,
  sendSurveyInviteReminder,
  // confirmProjectInvite,
} from "../invites/surveyInvites";

const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());

const SurveyInvitesPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      type SurveyInviteTokenClaims {
        surveyId: Int!
        inviteId: Int!
        fullname: String
        email: String
        wasUsed: Boolean!
        projectId: Int!
      }

      type SurveyInviteTokenVerificationResults {
        error: String
        claims: SurveyInviteTokenClaims
      }

      type OutstandingSurveyInvites {
        token: String!
        projectId: Int!
        surveyId: Int!
      }

      extend type Query {
        """
        Verify whether the an invite token has a valid signature and has not yet
        expired or been used.

        Use before starting an invite-only survey. For info on invite handling
        [see the wiki](https://github.com/seasketch/next/wiki/User-Ingress#survey-invites)
        """
        verifySurveyInvite(
          """
          JWT string
          """
          token: String!
        ): SurveyInviteTokenVerificationResults
      }

      extend type Mutation {
        """
        Send a reminder email for a survey invite that has already been sent.
        Returns the same inviteId if successful.
        """
        sendSurveyInviteReminder(
          """
          ID of survey invite
          """
          inviteId: Int!
        ): Int
      }
    `,
    resolvers: {
      Mutation: {
        sendSurveyInviteReminder: async (
          _query,
          args,
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          await sendSurveyInviteReminder(pgClient, args.inviteId);
          return args.inviteId;
        },
      },
      Query: {
        verifySurveyInvite: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          try {
            const claims = await verifySurveyInvite(
              pgClient,
              args.token,
              ISSUER
            );
            return {
              claims,
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

export default SurveyInvitesPlugin;
