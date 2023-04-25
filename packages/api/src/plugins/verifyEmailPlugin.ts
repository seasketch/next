import { postgraphile } from "postgraphile";
import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { sign } from "../auth/jwks";
import sendEmail from "../invites/sendEmail";
import htmlTemplate from "../invites/verifyEmailTemplate";
import textTemplate from "../invites/verifyEmailTemplateText";
import { default as mustache } from "mustache";
import { sendEmailVerification } from "../emailVerification";

const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());

/**
 * This plugin adds a mutation to verify a user's email address. The
 * sendEmailVerification mutation will send an email to the user with a
 * link to verify their email address. It returns a status indicating whether
 * their email is already verified or if an email was sent.
 */
const VerifyEmailPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      enum EmailVerificationStatus {
        """
        The email address is already verified
        """
        VERIFIED
        """
        An email was sent to the address
        """
        EMAIL_SENT
      }

      extend type Mutation {
        """
        Send an email to the user with a link to verify their email address.
        If the user's email is already verified, no email will be sent.
        """
        sendEmailVerification(redirectUrl: String): EmailVerificationStatus!
      }

      extend type Query {
        isMyEmailVerified: Boolean!
      }
    `,
    resolvers: {
      Mutation: {
        sendEmailVerification: async (mutation, args, context, resolveInfo) => {
          const { adminPool: pgClient, user } = context;
          if (!user) {
            throw new Error(
              "You must be logged in to send an email verification"
            );
          }
          const { sub, canonicalEmail } = user;
          const { redirectUrl } = args;
          if (user.emailVerified) {
            return "VERIFIED";
          }
          await sendEmailVerification(
            pgClient,
            sub,
            canonicalEmail,
            redirectUrl
          );
          return "EMAIL_SENT";
        },
      },
      Query: {
        isMyEmailVerified: async (_, args, context, resolveInfo) => {
          return Boolean(context?.user?.emailVerified);
        },
      },
    },
  };
});

export default VerifyEmailPlugin;
