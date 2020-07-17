import { ManagementClient } from "auth0";

const auth0 = new ManagementClient({
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  domain: process.env.AUTH0_DOMAIN!,
  scope: "read:users update:users",
});

export async function getCanonicalEmails(
  subs: string[]
): Promise<{ [sub: string]: string }> {
  const emails: { [sub: string]: string } = {};
  const users = await auth0.getUsers({
    fields: "email,user_id",
    q: subs.map((sub) => `(user_id:"${sub}")`).join(" OR "),
    include_fields: true,
  });
  for (const user of users) {
    if (user.email && user.user_id) {
      emails[user.user_id] = user.email;
    }
  }
  return emails;
}

export async function getSubsForEmails(
  emails: string[]
): Promise<{ [email: string]: string }> {
  const subs: { [email: string]: string } = {};
  const users = await auth0.getUsers({
    fields: "email,user_id",
    q: emails.map((email) => `(email:"${email}")`).join(" OR "),
    include_fields: true,
  });
  for (const user of users) {
    if (user.email && user.user_id) {
      subs[user.email] = user.user_id;
    }
  }
  return subs;
}

export async function verifyEmail(sub: string) {
  return auth0.updateUser(
    {
      id: sub,
    },
    {
      email_verified: true,
    }
  );
}
