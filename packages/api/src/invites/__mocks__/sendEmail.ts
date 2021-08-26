let counter = 0;

export default async function sendEmail(
  destination: string,
  subject: string,
  htmlEmail: string,
  textEmail: string
) {
  return Promise.resolve({
    $response: {},
    MessageId: `test-email-id-${counter++}`,
  });
}
