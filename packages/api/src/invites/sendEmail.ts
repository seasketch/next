import SES from "aws-sdk/clients/ses";
import fs from "fs";
import { isE2ETestModeEnabled } from "../e2e/testMode";
import { writeE2EEmail } from "../e2e/mailbox";
const ses = new SES();

/**
 * Simplified wrapper for sending email via SES. Crucially, it's easier to mock
 * for testing
 * @param destination to-field
 * @param subject
 * @param htmlEmail
 * @param textEmail
 * @returns
 */
export default async function sendEmail(
  destination: string,
  subject: string,
  htmlEmail: string,
  textEmail: string
) {
  if (isE2ETestModeEnabled()) {
    writeE2EEmail(destination, subject, htmlEmail, textEmail);
    return { MessageId: "e2e-test-mode" };
  }
  if (!process.env.SES_EMAIL_SOURCE) {
    throw new Error(`SES_EMAIL_SOURCE environment variable not set`);
  }
  if (process.env.IS_CYPRESS_TEST_ENV === "true") {
    fs.writeFileSync(
      "./invite-emails-cypress/email",
      `Destination: ${destination}\n`,
      { encoding: "utf8", flag: "w" }
    );
    fs.appendFileSync(
      "./invite-emails-cypress/email",
      `Email text: ${textEmail}`
    );
    return { MessageId: "cypress-test-env" };
  }
  return ses
    .sendEmail({
      Destination: {
        ToAddresses: [destination],
      },
      Source: process.env.SES_EMAIL_SOURCE,
      Message: {
        Subject: {
          Data: subject,
        },
        Body: {
          Html: { Data: htmlEmail },
          Text: { Data: textEmail },
        },
      },
    })
    .promise();
}
