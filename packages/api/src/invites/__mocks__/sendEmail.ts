let counter = 0;

export default async function sendEmail(
  destination: string,
  subject: string,
  htmlEmail: string,
  textEmail: string
) {
  if (!process.env.SES_EMAIL_SOURCE) {
    throw new Error(`SES_EMAIL_SOURCE environment variable not set`);
  }
  return Promise.resolve({
    $response: {},
    MessageId: `test-email-id-${counter++}`,
  });
}
