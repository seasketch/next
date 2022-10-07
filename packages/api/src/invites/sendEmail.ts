import SES from "aws-sdk/clients/ses";
import {writeFileSync} from "fs";
const ses = new SES();
const fs = require ('fs')

process.env.IS_CYPRESS_TEST_ENV = "true"

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
  if (process.env.IS_CYPRESS_TEST_ENV) {
    //@ts-ignore
    fs.writeFileSync('./invite-emails-cypress/email', `Destination: ${destination}\n`, {encoding:'utf8',flag:'w'}), (err) => {
      if (err) {
        console.log(`Error: ${err}`)
      }
    };
    fs.appendFileSync('./invite-emails-cypress/email', `Email text: ${textEmail}`);
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
