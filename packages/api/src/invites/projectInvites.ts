import { sign, verify } from "../auth/jwks";
import ms from "ms";
const HOST = process.env.HOST || "seasketch.org";
// TODO: replace auth0 dependency with plain http requests to the management api
// The library is incredibly bulky, adding 2.5MB to lambda sizes
import { ManagementClient } from "auth0";
import { DBClient } from "../dbClient";
import { default as mustache } from "mustache";
import sendEmail from "./sendEmail";
import * as cache from "../cache";
import htmlTemplate from "./projectInviteTemplate";
import textTemplate from "./projectInviteTemplateText";

export type ProjectInviteTokenClaims = {
  projectId: number;
  projectName: string;
  inviteId: number;
  admin: boolean;
  fullname?: string;
  email: string;
  emailId: number;
  projectSlug: string;
};

export async function sendProjectInviteEmail(
  emailId: number,
  client: DBClient
) {
  const results: {
    id: number;
    projectId: number;
    fullname: string;
    email: string;
    makeAdmin: boolean;
    inviteId: number;
    userId: number | null;
    unsubscribed: boolean | null;
    subject: string;
    template: string;
    projectName: string;
    projectSlug: string;
    supportEmail: string;
  }[] = (
    await client.query(
      `
      select
        invite_emails.*,
        project_invites.email,
        project_invites.fullname,
        project_invites.project_id as "projectId",
        project_invites.make_admin as "makeAdmin",
        project_invites.id as "inviteId",
        email_unsubscribed(invite_emails.to_address) as "unsubscribed",
        projects.invite_email_subject as "subject",
        projects.name as "projectName",
        projects.slug as "projectSlug",
        projects.support_email as "supportEmail"
      from
        invite_emails
      inner join
        project_invites
      on
        project_invites.id = invite_emails.project_invite_id
      inner join
        projects
      on
        project_invites.project_id = projects.id
      where
        invite_emails.id = $1
        `,
      [emailId]
    )
  ).rows;
  if (results.length === 1) {
    try {
      const inviteData = results[0];
      if (inviteData.unsubscribed) {
        await client.query(
          `update invite_emails set status = 'UNSUBSCRIBED', updated_at = now() where id = $1`,
          [emailId]
        );
        return;
      }

      if (!process.env.SES_EMAIL_SOURCE && process.env.NODE_ENV !== "test") {
        throw new Error(`SES_EMAIL_SOURCE environment variable not set`);
      }

      const { token, expiration } = await createToken(client, {
        projectName: inviteData.projectName,
        projectId: inviteData.projectId,
        fullname: inviteData.fullname,
        email: inviteData.email,
        admin: inviteData.makeAdmin,
        inviteId: inviteData.inviteId,
        emailId: inviteData.id,
        projectSlug: inviteData.projectSlug,
      });

      const templateVars = {
        name: inviteData.fullname,
        email: inviteData.email,
        action_url: `https://${process.env.CLIENT_DOMAIN}/auth/projectInvite?token=${token}`,
        project_name: inviteData.projectName,
        support_email: inviteData.supportEmail || "support@seasketch.org",
        docs_url: "http://help.seasketch.org",
      };
      const textEmail = mustache.render(textTemplate, templateVars);
      const htmlEmail = mustache.render(htmlTemplate, templateVars);

      const response = await sendEmail(
        inviteData.email,
        `You have been invited to ${inviteData.projectName}`,
        htmlEmail,
        textEmail
      );
      // @ts-ignore
      const errors = response.$response?.error;
      if (errors) {
        await client.query(
          `update invite_emails set status = 'ERROR', updated_at = now(), error = $1 where id = $2`,
          [errors || "Unknown SES Error", emailId]
        );
      } else {
        await client.query(
          `update invite_emails set status = 'SENT', token = $1, token_expires_at = to_timestamp($2), message_id = $3, error = null, updated_at = now() where id = $4
          `,
          [token, expiration / 1000, response.MessageId, emailId]
        );
      }
    } catch (e: any) {
      await client.query(
        `update invite_emails set status = 'ERROR', updated_at = now(), error = $1 where id = $2`,
        [e.toString() || "Unknown Error", emailId]
      );
      throw e;
    }
  } else {
    throw new Error(`Could not find invite_email with id = ${emailId}`);
  }
}

async function createToken(client: DBClient, claims: ProjectInviteTokenClaims) {
  // admins have less time to use invites since they'are more sensitive
  const expiration = claims.admin ? "30 days" : "90 days";
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
    update invite_emails set status = $1 where message_id = $2 returning status`,
    [status, messageId]
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
    throw e;
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
  const userId = (
    await client.query(
      `select current_setting('session.user_id', true) as user_id`
    )
  ).rows[0].user_id;
  // verify email using the auth0 api (if necessary)
  const { emailVerified, sub } = (
    await client.query(
      `select users.sub, current_setting('session.email_verified')::boolean from users where id = $1`,
      [userId]
    )
  ).rows[0];
  const auth0 = await getManagementClient();
  if (!emailVerified) {
    try {
      await auth0.updateUser({ id: sub as string }, { email_verified: true });
    } catch (e) {
      console.error(e);
      throw e;
    }
    await cache.set(`user:${sub}:emailVerified`, "true");
  }
  await client.query(`select confirm_project_invite($1)`, [claims.inviteId]);
  await client.query(
    `SELECT set_config('session.escalate_privileges', null, true)`
  );
  return {
    ...claims,
    wasUsed: true,
  };
}

let managementClient: ManagementClient;
async function getManagementClient(): Promise<ManagementClient> {
  if (!managementClient) {
    managementClient = new ManagementClient({
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      domain: process.env.AUTH0_DOMAIN!,
      scope: "update:users",
    });
  }
  return managementClient;
}

function swap(kv: { [key: string]: string }) {
  var ret: { [key: string]: string } = {};
  for (var key in kv) {
    ret[kv[key]] = key;
  }
  return ret;
}
