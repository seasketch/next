import { DBClient } from "../dbClient";

/** Auth0 Management stand-in. Test users exist only in this database. */
export async function lookupCanonicalEmails(
  client: DBClient,
  subs: string[]
): Promise<{ [sub: string]: string }> {
  if (subs.length === 0) {
    return {};
  }
  const { rows } = await client.query(
    `select sub, canonical_email from users where sub = any($1::text[])`,
    [subs]
  );
  const emails: { [sub: string]: string } = {};
  for (const row of rows) {
    if (row.sub && row.canonical_email) {
      emails[row.sub] = row.canonical_email;
    }
  }
  return emails;
}

export async function lookupSubsForEmails(
  client: DBClient,
  emails: string[]
): Promise<{ [email: string]: string }> {
  if (emails.length === 0) {
    return {};
  }
  const { rows } = await client.query(
    `select sub, canonical_email from users where canonical_email = any($1::text[])`,
    [emails]
  );
  const subs: { [email: string]: string } = {};
  for (const row of rows) {
    if (row.sub && row.canonical_email) {
      subs[row.canonical_email] = row.sub;
    }
  }
  return subs;
}
