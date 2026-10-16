import { AwsClient } from "aws4fetch";

const SUPPORT_EMAIL = "support@seasketch.org";
const FROM_EMAIL = "noreply@seasketch.org";

/**
 * On failure, post to #ssn-notifications and email support@seasketch.org.
 * Stays quiet unless NOTIFY_ENABLED is the string "true".
 *
 * @param {{ NOTIFY_ENABLED?: string, SLACK_TOKEN?: string, SLACK_CHANNEL?: string, AWS_ACCESS_KEY_ID?: string, AWS_SECRET_ACCESS_KEY?: string }} env
 * @param {{ ok: boolean, checks: { name: string, ok: boolean, detail: string }[] }} result
 */
export async function notifyFailure(env, result) {
  if (env.NOTIFY_ENABLED !== "true") {
    return { slack: "disabled", email: "disabled" };
  }
  const text = failureText(result);
  const channel = env.SLACK_CHANNEL || "ssn-notifications";
  const [slack, email] = await Promise.all([
    env.SLACK_TOKEN
      ? catchError(() => postSlack(env.SLACK_TOKEN, channel, text))
      : "skipped",
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? catchError(() => sendSes(env, "SeaSketch production probe failed", text))
      : "skipped",
  ]);
  return { slack, email };
}

export function failureText(result) {
  const lines = result.checks
    .filter((check) => !check.ok)
    .map((check) => `- ${check.name}: ${check.detail}`);
  const lead =
    result.attempts > 1
      ? "SeaSketch production probe failed on two consecutive runs."
      : "SeaSketch production probe failed.";
  return [lead, ...lines].join("\n");
}

async function postSlack(token, channel, text) {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text }),
  });
  const body = await response.json();
  if (!body.ok) {
    throw new Error(`Slack chat.postMessage failed: ${body.error}`);
  }
  return "sent";
}

async function sendSes(env, subject, text) {
  const aws = new AwsClient({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    service: "ses",
    region: "us-west-2",
  });
  const body = new URLSearchParams({
    Action: "SendEmail",
    Source: FROM_EMAIL,
    "Destination.ToAddresses.member.1": SUPPORT_EMAIL,
    "Message.Subject.Data": subject,
    "Message.Subject.Charset": "UTF-8",
    "Message.Body.Text.Data": text,
    "Message.Body.Text.Charset": "UTF-8",
  });
  const response = await aws.fetch("https://email.us-west-2.amazonaws.com/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`SES returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  await response.body?.cancel();
  return "sent";
}

async function catchError(fn) {
  try {
    return await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
