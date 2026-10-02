import { ManagementClient } from "auth0";
import { MisconfiguredError } from "../env";
import pool from "../pool";
import { isE2ETestModeEnabled } from "../e2e/testMode";
import {
  lookupCanonicalEmails,
  lookupSubsForEmails,
} from "../e2e/directory";

export const AUTH0_MANAGEMENT_NOT_CONFIGURED =
  "Auth0 management is misconfigured";

let managementClient: ManagementClient | null | undefined;

function auth0ManagementConfigured(): boolean {
  return Boolean(
    process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET
  );
}

/**
 * Lazily creates the Auth0 Management API client. Returns null when
 * AUTH0_DOMAIN, AUTH0_CLIENT_ID, or AUTH0_CLIENT_SECRET is unset so the API
 * can start without Auth0 and features that need management fail closed.
 */
export function getManagementClient(): ManagementClient | null {
  if (managementClient !== undefined) {
    return managementClient;
  }
  if (!auth0ManagementConfigured()) {
    managementClient = null;
    return null;
  }
  managementClient = new ManagementClient({
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    domain: process.env.AUTH0_DOMAIN!,
    scope: "read:users update:users",
  });
  return managementClient;
}

/** Exposed for unit tests so cached client state does not leak between cases. */
export function resetManagementClientForTests() {
  managementClient = undefined;
}

function requireManagementClient(): ManagementClient {
  const client = getManagementClient();
  if (!client) {
    const missing = (
      ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET"] as const
    ).filter((name) => !process.env[name]);
    throw new MisconfiguredError("Auth0 management", [...missing]);
  }
  return client;
}

export async function getCanonicalEmails(
  subs: string[]
): Promise<{ [sub: string]: string }> {
  if (isE2ETestModeEnabled()) {
    return lookupCanonicalEmails(pool, subs);
  }
  const auth0 = requireManagementClient();
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
  if (isE2ETestModeEnabled()) {
    return lookupSubsForEmails(pool, emails);
  }
  const auth0 = requireManagementClient();
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
  if (isE2ETestModeEnabled()) {
    // There is no Auth0 user to update. The next test token carries
    // email_verified, and invite acceptance records the cache flag itself.
    return { user_id: sub, email_verified: true };
  }
  const auth0 = requireManagementClient();
  return auth0.updateUser(
    {
      id: sub,
    },
    {
      email_verified: true,
    }
  );
}
