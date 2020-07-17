import { sign, verify } from "../auth/jwks";
import ms from "ms";
const HOST = process.env.HOST || "https://seasketch.org";
const PROJECT_INVITE_SES_TEMPLATE =
  process.env.PROJECT_INVITE_SES_TEMPLATE || "SeaSketchProjectInvite";
const SES_EMAIL_SOURCE =
  process.env.SES_EMAIL_SOURCE || "noreply@seasketch.org";
import SES from "aws-sdk/clients/ses";
import { ManagementClient } from "auth0";
import { DBClient } from "../dbClient";
import { getSubsForEmails } from "../auth/auth0";

const ses = new SES();

type ProjectInviteTokenClaims = {
  projectId: number;
  inviteId: number;
  admin: boolean;
  fullname: string;
  email: string;
  emailId: number;
};

/**
 * Fetches QUEUED project invite emails from the database and sends them out
 * using SES, updating their status to SENT.
 *
 * sendQueuedInvites can be run by an npm or cron script, or within a lambda
 * handler to periodically check for project invite emails that need sending.
 * It's important to note that the function itself does not use transactions,
 * and running multiple times in parallel could result in multiple sends. For
 * this reason, consumers of api should provide the database client with a
 * transaction to be rolled back upon failure. If using lambda, cloudwatch
 * events could be used to run this function every minute or so.
 * @export
 * @param {DBClient} client
 * @param {number} [limit=50]
 */
export async function sendQueuedInvites(client: DBClient, limit = 50) {
  if (limit > 50) {
    throw new Error(`sendBulkTemplatedEmail limits batches to 50 emails`);
  }
  let projectInviteEmails: {
    id: number;
    project_id: number;
    fullname: string;
    email: string;
    make_admin: boolean;
    inviteId: number;
  }[] = (
    await client.query(
      `
      select
        invite_emails.*,
        project_invites.email,
        project_invites.fullname,
        project_invites.project_id,
        project_invites.make_admin,
        project_invites.id as "inviteId"
      from
        invite_emails
      inner join
        project_invites
      on
        project_invites.id = invite_emails.project_invite_id
      where
        invite_emails.status = 'QUEUED' and invite_emails.survey_invite_id is null
      limit $1`,
      [limit]
    )
  ).rows;
  if (projectInviteEmails.length === 0) {
    return 0;
  }
  const existingUserSubs = await getSubsForEmails(
    projectInviteEmails.map((i) => i.email)
  );
  const emailsBySub: { [sub: string]: string } = swap(existingUserSubs);
  const { rows } = await client.query(
    `
      select 
        users.sub
      from 
        users
      inner join
        email_notification_preferences 
      on
        email_notification_preferences.user_id = users.id
      where 
        email_notification_preferences.unsubscribe_all = true and 
        users.sub = any($1::text[])
    `,
    [Object.values(existingUserSubs)]
  );
  const unsubscribedEmails = rows.map((r) => emailsBySub[r.sub]);
  const tokens: {
    [id: number]: { token_expires_at: number; token: string };
  } = {};
  projectInviteEmails = projectInviteEmails.filter(
    (i) => unsubscribedEmails.indexOf(i.email) === -1
  );
  // update status of invites for any unsubscribed users
  // note this will impact notifications that weren't picked up in the batch
  // limit (50), but that's fine.
  await client.query(
    `
    update 
      invite_emails
    set 
      status = 'UNSUBSCRIBED'
    where
      to_address = any($1::text[])
  `,
    [unsubscribedEmails]
  );
  if (projectInviteEmails.length > 0) {
    for (const invite of projectInviteEmails) {
      const { token, expiration } = await createToken(client, {
        projectId: invite.project_id,
        fullname: invite.fullname,
        email: invite.email,
        admin: invite.make_admin,
        inviteId: invite.inviteId,
        emailId: invite.id,
      });
      tokens[invite.id] = {
        token,
        token_expires_at: expiration / 1000,
      };
    }
    const response = await ses
      .sendBulkTemplatedEmail({
        Source: SES_EMAIL_SOURCE,
        Template: PROJECT_INVITE_SES_TEMPLATE,
        Destinations: projectInviteEmails.map((invite) => ({
          Destination: {
            ToAddresses: [invite.email],
          },
          ReplacementTags: [
            {
              Name: "inviteLink",
              Value: `${HOST}/auth/projectInvite?token=${
                tokens[invite.id].token
              }`,
            },
          ],
        })),
      })
      .promise();
    for (let i = 0; i < response.Status.length; i++) {
      const status = response.Status[i];
      if (status.Status === "Success" && status.MessageId) {
        await client.query(
          `update invite_emails set status = 'SENT', token = $1, token_expires_at = to_timestamp($2), message_id = $3 where id = $4
          `,
          [
            tokens[projectInviteEmails[i].id].token,
            tokens[projectInviteEmails[i].id].token_expires_at,
            status.MessageId,
            projectInviteEmails[i].id,
          ]
        );
      } else {
        await client.query(
          `update invite_emails set status = 'ERROR' error = $1 where id = $2`,
          [status.Error || "Unknown SES Error", projectInviteEmails[i].id]
        );
      }
    }
  }
  return projectInviteEmails.length;
}

async function createToken(client: DBClient, claims: ProjectInviteTokenClaims) {
  const expiration = claims.admin ? "14 days" : "60 days";
  const token = await sign(client, claims, expiration, HOST);
  return {
    token,
    expiration: new Date().getTime() + ms(expiration),
  };
}

/**
 * A resilient method for updating the status of emails is to setup SNS
 * Notifications integration with SES, then have Lambda functions handle new
 * events. These lambda can use this method to easily update email status.
 *
 * Can be used for both Project Invites and Survey Invites
 *
 * @export
 * @param {DBClient} client
 * @param {string} email
 * @param {string} messageId
 * @param {("Bounce" | "Complaint" | "Delivery")} notificationType Matches types found in https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html
 * @returns
 */
export async function updateStatus(
  client: DBClient,
  email: string,
  messageId: string,
  notificationType: "Bounce" | "Complaint" | "Delivery"
) {
  let status = "DELIVERED";
  if (notificationType === "Bounce") {
    status = "BOUNCED";
  } else if (notificationType === "Complaint") {
    status = "COMPLAINT";
  }
  const { rows } = await client.query(
    `
    update invite_emails set status = $1 where to_address = $2 and message_id = $3 returning status`,
    [status, email, messageId]
  );
  return rows.length;
}

/**
 * Checks jwt signature, ensures inviteId and projectId are present.
 * Returns claims with an added was_used boolean. Clients are responsible for
 * checking was_used and informing users. confirmProjectInviteToken() will fail
 * if called with a used token.
 * @export
 * @param {DBClient} client
 * @param {string} token
 * @param {string} host verifies iss claim
 * @returns
 */
export async function verifyProjectInvite(
  client: DBClient,
  token: string,
  host: string
) {
  let claims;
  try {
    claims = await verify<ProjectInviteTokenClaims>(client, token, host);
  } catch (e) {
    throw new Error("Invalid token signature");
  }
  if (!claims.projectId) {
    throw new Error("projectId not present in claims");
  }
  if (!claims.inviteId) {
    throw new Error("inviteId not present in claims");
  }
  const wasUsed = (
    await client.query(`select project_invite_was_used($1)`, [claims.inviteId])
  ).rows[0].project_invite_was_used as boolean;
  return {
    ...claims,
    wasUsed,
  };
}

/**
 * Confirms a project invite using the current session user. Assigns any admin
 * and group privileges, and marks the invite as used.
 *
 * @export
 * @param {DBClient} client
 * @param {string} token
 * @param {string} host
 */
export async function confirmProjectInvite(
  client: DBClient,
  token: string,
  host: string
) {
  // verify token
  const claims = await verifyProjectInvite(client, token, host);
  // ensure it hasn't been used before
  if (claims.wasUsed === true) {
    throw new Error("Project invite has already been accepted");
  }
  // set escalated privileges bit
  await client.query(
    `SELECT set_config('session.escalate_privileges', 'on', true)`
  );
  // Most operations are completed in the sql function
  const userId = (
    await client.query(`select confirm_project_invite($1)`, [claims.inviteId])
  ).rows[0].confirm_project_invite;
  await client.query(
    `SELECT set_config('session.escalate_privileges', null, true)`
  );
  // verify email using the auth0 api (if necessary)
  const { emailVerified, sub } = (
    await client.query(
      `select users.sub, current_setting('session.email_verified')::boolean from users where id = $1`,
      [userId]
    )
  ).rows[0];
  const auth0 = new ManagementClient({
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    domain: process.env.AUTH0_DOMAIN!,
    scope: "update:users",
  });
  if (!emailVerified) {
    // TODO: test this operation on the production system manually
    await auth0.updateUser({ id: sub as string }, { email_verified: true });
  }
  return {
    ...claims,
    wasUsed: true,
  };
}

function swap(kv: { [key: string]: string }) {
  var ret: { [key: string]: string } = {};
  for (var key in kv) {
    ret[kv[key]] = key;
  }
  return ret;
}
