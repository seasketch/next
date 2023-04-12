import { sign, verify } from "../auth/jwks";
import ms from "ms";
const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());
const HOST = ISSUER[0];
const SURVEY_INVITE_SES_TEMPLATE =
  process.env.SURVEY_INVITE_SES_TEMPLATE || "SeaSketchSurveyInvite";
const SURVEY_INVITE_REMINDER_SES_TEMPLATE =
  process.env.SURVEY_INVITE_REMINDER_SES_TEMPLATE ||
  "SeaSketchSurveyInviteReminder";
const SES_EMAIL_SOURCE =
  process.env.SES_EMAIL_SOURCE || "noreply@seasketch.org";
import SES from "aws-sdk/clients/ses";
import { DBClient } from "../dbClient";
import { getCanonicalEmails } from "../auth/auth0";

const ses = new SES();

export type SurveyInviteTokenClaims = {
  surveyId: number;
  inviteId: number;
  fullname: string | null;
  email: string;
  accessType: "PUBLIC" | "INVITE_ONLY";
  projectId: number;
};

/**
 * Sends invite emails for any outstanding survey invites (indicated by QUEUED
 * status). This process should run periodically using cron or scheduled lambdas
 * once every 10 seconds or so. Operations "lock" a set of records during
 * use so it should not be a problem if multiple tasks run simultaneously in
 * exceptional circumstances.
 *
 * See [the wiki](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management)
 * for more details on the invite system.
 *
 * @export
 * @param {DBClient} client
 * @param {number} [limit=50] Number of invites to process at one time. SES
 * batch email sending is limited to 50
 * @returns
 */
export async function sendQueuedSurveyInvites(client: DBClient, limit = 50) {
  if (limit > 50) {
    throw new Error(`sendBulkTemplatedEmail limits batches to 50 emails`);
  }
  // look for survey_invites with a status of QUEUED that are part of an active survey
  const results = await client.query(
    `
    select
      survey_id as "surveyId",
      survey_invites.id as "inviteId",
      survey_invites.user_id as "userId",
      fullname,
      email,
      survey_invites_status(survey_invites.*) as status,
      surveys.access_type as "accessType",
      users.sub as sub,
      email_notification_preferences.unsubscribe_all as unsubscribed,
      surveys.project_id as "projectId"
    from
      survey_invites
    inner join
      surveys
    on
      survey_invites.survey_id = surveys.id
    left outer join
      users
    on
      survey_invites.user_id = users.id
    left outer join
      email_notification_preferences
    on
      email_notification_preferences.user_id = survey_invites.user_id
    where
      survey_invites.created_at > now() - interval '120 days' and
      survey_invites_status(survey_invites.*) = 'QUEUED' and
      surveys.is_disabled = false
    limit $1`,
    [limit]
  );
  let surveyInvites: {
    userId: number | null;
    sub: string | null;
    surveyId: number;
    inviteId: number;
    fullname: string | null;
    email: string | null;
    accessType: "PUBLIC" | "INVITE_ONLY";
    unsubscribed: boolean;
    projectId: number;
  }[] = results.rows;
  // make sure the email is set for each recipient
  const userSubsMissingEmail = surveyInvites.reduce((userSubs, invite) => {
    if (invite.email === null && invite.sub !== null) {
      userSubs.push(invite.sub);
    }
    return userSubs;
  }, [] as string[]);
  if (userSubsMissingEmail.length > 0) {
    const emails = await getCanonicalEmails(userSubsMissingEmail);
    for (const invite of surveyInvites) {
      if (invite.sub !== null) {
        invite.email = emails[invite.sub];
      }
    }
  }

  // create tokens for each recipient
  const tokens: {
    [inviteId: number]: { token_expires_at: number; token: string };
  } = {};
  for (const invite of surveyInvites) {
    if (invite.email) {
      tokens[invite.inviteId] = await createToken(
        client,
        invite as SurveyInviteTokenClaims
      );
    } else {
      throw new Error(
        `Email not found for survey_invite id=${invite.inviteId}`
      );
    }
  }

  const unsubscribed = surveyInvites.filter((i) => i.unsubscribed);
  // create failed invite_email with status = UNSUBSCRIBED
  if (unsubscribed.length > 0) {
    await client.query(
      `
        insert into invite_emails(
          survey_invite_id,
          status,
          token_expires_at,
          token,
          to_address
        ) select t.survey_invite_id,
        t.status,
        t.token_expires_at,
        t.token,
        t.to_address
        from json_populate_recordset(null::invite_emails, $1) as t
        returning id
      `,
      [
        JSON.stringify(
          unsubscribed.map((i) => ({
            survey_invite_id: i.inviteId,
            status: "UNSUBSCRIBED",
            token_expires_at: new Date(tokens[i.inviteId].token_expires_at),
            token: tokens[i.inviteId].token,
            to_address: i.email?.toLowerCase(),
          }))
        ),
      ]
    );
  }
  surveyInvites = surveyInvites.filter((i) => !i.unsubscribed);
  if (surveyInvites.length === 0) {
    return;
  }
  const surveyName = (
    await client.query(`select name from surveys where id = $1`, [
      surveyInvites[0].surveyId,
    ])
  ).rows[0].name;

  // create email invite records for all recipients
  const insertRecords = surveyInvites.map((i) => ({
    survey_invite_id: i.inviteId,
    status: "SENT",
    token_expires_at: new Date(tokens[i.inviteId].token_expires_at),
    token: tokens[i.inviteId].token,
    to_address: i.email?.toLowerCase(),
  }));
  const inviteEmailResults = await client.query(
    `
      insert into invite_emails(
        survey_invite_id,
        status,
        token_expires_at,
        token,
        to_address
      ) select t.survey_invite_id,
      t.status,
      t.token_expires_at,
      t.token,
      t.to_address
      from json_populate_recordset(null::invite_emails, $1) as t
      returning id
    `,
    [JSON.stringify(insertRecords)]
  );

  // send out emails in bulk
  try {
    const response = await ses
      .sendBulkTemplatedEmail({
        Source: SES_EMAIL_SOURCE,
        Template: SURVEY_INVITE_SES_TEMPLATE,
        Destinations: surveyInvites.map((invite) => ({
          Destination: {
            ToAddresses: [invite.email!],
          },
          ReplacementTags: [
            {
              Name: "inviteLink",
              Value: `${HOST}/auth/surveyInvite?token=${
                tokens[invite.inviteId].token
              }`,
            },
            {
              Name: "surveyName",
              Value: surveyName,
            },
          ],
        })),
      })
      .promise();
    if (response.Status.length !== inviteEmailResults.rows.length) {
      throw new Error(
        "Number of status messages from SES doesn't match number of invite emails generated."
      );
    }
    for (let i = 0; i < response.Status.length; i++) {
      const status = response.Status[i];
      if (status.Status === "Success" && status.MessageId) {
        await client.query(
          `update invite_emails set message_id = $1 where id = $2
          `,
          [status.MessageId, inviteEmailResults.rows[i].id]
        );
      } else {
        await client.query(
          `update invite_emails set status = 'ERROR', error = $1 where id = $2`,
          [status.Error || "Unknown SES Error", inviteEmailResults.rows[i].id]
        );
      }
    }
  } catch (e) {
    // if bulk emailing throws an exception, delete all newly created email rows
    // this way running the process again should succeed if there is an
    // ephemeral problem with SES
    await client.query(`delete from invite_emails where id = any($1)`, [
      inviteEmailResults.rows.map((r) => r.id),
    ]);
    console.error(e);
    throw new Error(
      "SES bulk email sending failed. invite_emails records rolled back"
    );
  }
}

async function createToken(client: DBClient, claims: SurveyInviteTokenClaims) {
  const expiration = claims.accessType === "PUBLIC" ? "2 years" : "60 days";
  const token = await sign(
    client,
    {
      projectId: claims.projectId,
      surveyId: claims.surveyId,
      inviteId: claims.inviteId,
      fullname: claims.fullname,
      email: claims.email,
      accessType: claims.accessType,
    },
    expiration,
    HOST
  );
  return {
    token,
    token_expires_at: new Date().getTime() + ms(expiration),
  };
}

/**
 * Send a reminder email to users who have not yet responded to a survey. The
 * initial survey invite email is sent automatically by the
 * sendQueuedSurveyInvites process. Admins can later send reminders to each user
 * manually.
 * @export
 * @param {DBClient} client
 * @param {number} inviteId Survey invite ID
 */
export async function sendSurveyInviteReminder(
  client: DBClient,
  inviteId: number
) {
  const { rows } = await client.query(
    `
    select
      survey_id as "surveyId",
      survey_invites.id as "inviteId",
      survey_invites.user_id as "userId",
      fullname,
      email,
      surveys.name as "surveyName",
      survey_invites_status(survey_invites.*) as status,
      surveys.access_type as "accessType",
      users.sub as sub,
      email_notification_preferences.unsubscribe_all as unsubscribed,
      surveys.is_disabled as "surveyIsDisabled",
      surveys.project_id as "projectId"
    from
      survey_invites
    inner join
      surveys
    on
      survey_invites.survey_id = surveys.id
    left outer join
      users
    on
      survey_invites.user_id = users.id
    left outer join
      email_notification_preferences
    on
      email_notification_preferences.user_id = survey_invites.user_id
    where
      survey_invites.id = $1  
  `,
    [inviteId]
  );
  if (rows.length === 0) {
    throw new Error("Cannot find survey invite (id = " + inviteId + ")");
  }
  const invite = rows[0];
  if (invite.surveyIsDisabled) {
    throw new Error(`Cannot resend invites for disabled survey`);
  }
  const status = invite.status;
  if (
    status === "DELIVERED" ||
    status === "TOKEN_EXPIRED" ||
    status === "ERROR" ||
    status === "UNSUBSCRIBED" ||
    status === "BOUNCED"
  ) {
    if (!invite.email && invite.sub) {
      const emails = await getCanonicalEmails([invite.sub]);
      invite.email = emails[invite.sub];
    }
    const tokenInfo = await createToken(
      client,
      invite as SurveyInviteTokenClaims
    );
    const result = await client.query(
      `
      insert into invite_emails(
        survey_invite_id,
        status,
        token_expires_at,
        token,
        to_address
      ) values (
        $1,
        $2,
        to_timestamp($3),
        $4,
        $5
      )
      returning id
    `,
      [
        invite.inviteId,
        "SENT",
        tokenInfo.token_expires_at,
        tokenInfo.token,
        invite.email,
      ]
    );
    const emailId = result.rows[0].id;
    try {
      const response = await ses
        .sendBulkTemplatedEmail({
          Source: SES_EMAIL_SOURCE,
          Template: SURVEY_INVITE_REMINDER_SES_TEMPLATE,
          Destinations: [
            {
              Destination: {
                ToAddresses: [invite.email],
              },
              ReplacementTags: [
                {
                  Name: "inviteLink",
                  Value: `${HOST}/auth/surveyInvite?token=${tokenInfo.token}`,
                },
                {
                  Name: "surveyName",
                  Value: invite.surveyName,
                },
              ],
            },
          ],
        })
        .promise();
      const status = response.Status[0];
      if (status.Status === "Success" && status.MessageId) {
        await client.query(
          `update invite_emails set message_id = $1 where id = $2
          `,
          [status.MessageId, emailId]
        );
      } else {
        await client.query(
          `update invite_emails set status = 'ERROR', error = $1 where id = $2`,
          [status.Error || "Unknown SES Error", emailId]
        );
      }
    } catch (e) {
      console.error(e);
      await client.query(`delete from invite_emails where id = $1`, [emailId]);
      throw e;
    }
  } else {
    if (status === "COMPLAINT") {
      throw new Error(
        `The user has marked SeaSketch messages as SPAM so SeaSketch is unable send more to their inbox.`
      );
    } else {
      throw new Error(`Cannot resend survey invite if status is ${status}`);
    }
  }
}

export async function verifySurveyInvite(
  client: DBClient,
  token: string,
  issuer: string | string[]
) {
  let claims;
  try {
    claims = await verify<SurveyInviteTokenClaims>(client, token, issuer);
  } catch (e: any) {
    if (e.name === "TokenExpiredError") {
      throw e;
    } else {
      throw new Error("Invalid token signature");
    }
  }
  if (!claims.projectId) {
    throw new Error("projectId not present in claims");
  }
  if (!claims.surveyId) {
    throw new Error("surveyId not present in claims");
  }
  if (!claims.inviteId) {
    throw new Error("inviteId not present in claims");
  }
  const wasUsed = (
    await client.query(`select survey_invite_was_used($1)`, [claims.inviteId])
  ).rows[0].survey_invite_was_used as boolean;
  const info = (
    await client.query(`select * from survey_validation_info($1)`, [
      claims.surveyId,
    ])
  ).rows[0];
  if (info.is_disabled) {
    new Error("Survey is disabled");
  }
  if (wasUsed && info.limit_to_single_response) {
    throw new Error("Already used invite token");
  }
  return {
    ...claims,
    wasUsed: !!wasUsed,
  };
}
