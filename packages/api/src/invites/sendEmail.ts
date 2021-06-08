import SES from "aws-sdk/clients/ses";
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
  if (!process.env.SES_EMAIL_SOURCE) {
    throw new Error(`SES_EMAIL_SOURCE environment variable not set`);
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
