import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { getCanonicalEmails } from "../auth/auth0";

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
    `,
    resolvers: {
      EmailNotificationPreference: {
        canonicalEmail: async (parent, args, context, info) => {
          const emails = await getCanonicalEmails([context.user.sub]);
          return emails[context.user.sub];
        },
      },
    },
  };
});

export default CanonicalEmailPlugin;
