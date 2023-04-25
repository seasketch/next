import { JobHelpers } from "graphile-worker";
import { sendEmailVerification } from "../src/emailVerification";

module.exports = async (payload: any, helpers: JobHelpers) => {
  const { sub, email, redirectUrl } = payload;
  helpers.logger.info(`Sending verification email to, ${sub}<${email}>`);
  await helpers.withPgClient(async (client) => {
    await sendEmailVerification(client, sub, email, redirectUrl);
  });
};
