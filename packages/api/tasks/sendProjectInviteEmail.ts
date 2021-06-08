import { JobHelpers } from "graphile-worker";
import { sendProjectInviteEmail } from "../src/invites/projectInvites";

module.exports = async (payload: any, helpers: JobHelpers) => {
  const { emailId } = payload;
  helpers.logger.info(`Sending, ${emailId}`);
  await helpers.withPgClient(async (client) => {
    await sendProjectInviteEmail(emailId, client);
  });
};
