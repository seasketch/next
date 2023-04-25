import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { getCanonicalEmails, client } from "../auth/auth0";
import { sendEmailVerification } from "../emailVerification";

const CanonicalEmailPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      extend type EmailNotificationPreference {
        """
        Email used when registering the account in Auth0. This email cannot be
        updated through the API, though it may be possible to do so manually by
        SeaSketch developers.

        This is the email by which users will recieve transactional emails like
        project and survey invites, and email notifications.
        """
        canonicalEmail: String
      }

      type SendVerificationEmailResults {
        success: Boolean!
        error: String
      }

      extend type Mutation {
        """
        Re-sends an email verification link to the canonical email for the
        current user session
        """
        resendVerificationEmail: SendVerificationEmailResults!
      }
    `,
    resolvers: {
      EmailNotificationPreference: {
        canonicalEmail: async (parent, args, context, info) => {
          const emails = await getCanonicalEmails([context.user.sub]);
          return emails[context.user.sub];
        },
      },
      Mutation: {
        resendVerificationEmail: async (_query, args, context, resolveInfo) => {
          try {
            await sendEmailVerification(
              context.adminPool,
              context.user.sub,
              context.user.canonicalEmail
            );
            return {
              success: true,
            };
          } catch (e: any) {
            return {
              success: false,
              error: e.toString(),
            };
          }
        },
      },
    },
  };
});

export default CanonicalEmailPlugin;
