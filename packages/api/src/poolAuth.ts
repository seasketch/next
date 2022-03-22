import { DBClient } from "./dbClient";
import { IncomingRequest } from "./middleware/IncomingRequest";

export const getPgSettings = (req: IncomingRequest) => {
  // These session vars will be added to each postgres transaction
  return {
    role: req.user
      ? req.user.superuser
        ? "seasketch_superuser"
        : "seasketch_user"
      : "anon",
    "session.project_id": req.projectId,
    "session.email_verified": !!req.user?.emailVerified,
    "session.canonical_email": req.user?.canonicalEmail,
    "session.user_id": req.user?.id,
    "session.request_ip": req.ip,
    "session.survey_invite_email": req.surveyInvite?.email,
    "session.survey_invite_id": req.surveyInvite?.inviteId,
  };
};

export async function setTransactionSessionVariables(
  settings: { [key: string]: string | number | undefined | boolean },
  client: DBClient
) {
  for (const key in settings) {
    if (settings[key] !== null && settings[key] !== undefined) {
      if (/role/.test(key)) {
        await client.query(`set role ${settings[key]}`);
      } else if (/session\./.test(key)) {
        await client.query(`select set_config($1, $2, true)`, [
          key,
          settings[key]?.toString(),
        ]);
      }
    }
  }
}
