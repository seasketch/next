export const SEASKETCH_SUPPORT_EMAIL = "support@seasketch.org";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactEmailProblem = "required" | "invalid";

export function normalizeContactEmail(value: string) {
  return value.trim();
}

export function contactEmailProblem(
  value: string
): ContactEmailProblem | undefined {
  const trimmed = normalizeContactEmail(value);
  if (!trimmed) {
    return "required";
  }
  if (!EMAIL.test(trimmed)) {
    return "invalid";
  }
  return undefined;
}

export function mailtoHref(email: string, subject?: string, body?: string) {
  // eslint-disable-next-line i18next/no-literal-string
  const href = "mailto:" + email;
  const params: string[] = [];
  if (subject) {
    // eslint-disable-next-line i18next/no-literal-string
    params.push("subject=" + encodeURIComponent(subject));
  }
  if (body) {
    // eslint-disable-next-line i18next/no-literal-string
    params.push("body=" + encodeURIComponent(body));
  }
  if (!params.length) {
    return href;
  }
  // eslint-disable-next-line i18next/no-literal-string
  return href + "?" + params.join("&");
}

/** Most mail apps truncate a mailto link well before this. */
const MAILTO_LIMIT = 1800;

/**
 * A support message about a broken invitation. The body is for the inbox,
 * so it stays in English rather than the visitor's language.
 */
export function inviteSupportMailto(details: {
  to?: string;
  error: string;
  projectName?: string | null;
  projectSlug?: string | null;
  recipientEmail?: string | null;
  inviteId?: number | null;
  signedInEmail?: string | null;
  pageUrl?: string | null;
}) {
  // eslint-disable-next-line i18next/no-literal-string
  const lines = ["Please help with this SeaSketch project invitation.", ""];
  const signedIn =
    details.signedInEmail && details.signedInEmail !== details.recipientEmail
      ? details.signedInEmail
      : undefined;
  const fields: Array<[string, string | number | null | undefined]> = [
    // eslint-disable-next-line i18next/no-literal-string
    ["Error", details.error],
    // eslint-disable-next-line i18next/no-literal-string
    ["Project", details.projectName],
    // eslint-disable-next-line i18next/no-literal-string
    ["Project address", details.projectSlug],
    // eslint-disable-next-line i18next/no-literal-string
    ["Invitation for", details.recipientEmail],
    // eslint-disable-next-line i18next/no-literal-string
    ["Invite id", details.inviteId],
    // eslint-disable-next-line i18next/no-literal-string
    ["Signed in as", signedIn],
  ];
  for (const [label, value] of fields) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    lines.push(`${label}: ${value}`);
  }
  const to = details.to || SEASKETCH_SUPPORT_EMAIL;
  // eslint-disable-next-line i18next/no-literal-string
  const subject = `SeaSketch invitation: ${details.error}`.slice(0, 140);
  return mailtoMessage(to, subject, lines.join("\n"), details.pageUrl);
}

/**
 * Inbox copy for an access gate. These strings are the email, not the page.
 */
export const accessSupportReason = {
  // eslint-disable-next-line i18next/no-literal-string
  adminsOnly: "This project can only be accessed by project administrators.",
  // eslint-disable-next-line i18next/no-literal-string
  invitation: "This project can only be accessed with an invitation.",
  // eslint-disable-next-line i18next/no-literal-string
  request: "I would like to request access to this project.",
  // eslint-disable-next-line i18next/no-literal-string
  pending: "My request for access has not been approved.",
  // eslint-disable-next-line i18next/no-literal-string
  verifyEmail: "I need help verifying my email address.",
  // eslint-disable-next-line i18next/no-literal-string
  adminArea: "This area is limited to project administrators.",
  // eslint-disable-next-line i18next/no-literal-string
  notFound: "This project could not be found.",
  // eslint-disable-next-line i18next/no-literal-string
  loadError: "The project could not be loaded.",
};

/**
 * A support message from a project access gate. Writes to the project's
 * support address when it has one, and to SeaSketch support otherwise.
 */
export function projectSupportMailto(details: {
  supportEmail?: string | null;
  projectName?: string | null;
  projectSlug?: string | null;
  reason: string;
  detail?: string | null;
  visitorEmail?: string | null;
  pageUrl?: string | null;
}) {
  const to = details.supportEmail?.trim() || SEASKETCH_SUPPORT_EMAIL;
  // eslint-disable-next-line i18next/no-literal-string
  const lines = ["Please help with access to this SeaSketch project.", ""];
  const fields: Array<[string, string | null | undefined]> = [
    // eslint-disable-next-line i18next/no-literal-string
    ["Project", details.projectName],
    // eslint-disable-next-line i18next/no-literal-string
    ["Project address", details.projectSlug],
    // eslint-disable-next-line i18next/no-literal-string
    ["Situation", details.reason],
    // eslint-disable-next-line i18next/no-literal-string
    ["Detail", details.detail && details.detail !== details.reason ? details.detail : undefined],
    // eslint-disable-next-line i18next/no-literal-string
    ["Signed in as", details.visitorEmail],
  ];
  for (const [label, value] of fields) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    lines.push(`${label}: ${value}`);
  }
  const subject = (
    // eslint-disable-next-line i18next/no-literal-string
    "SeaSketch access: " + (details.projectName || details.reason)
  ).slice(0, 140);
  return mailtoMessage(to, subject, lines.join("\n"), details.pageUrl);
}

function mailtoMessage(
  to: string,
  subject: string,
  body: string,
  pageUrl?: string | null
) {
  const page = pageUrl
    ? mailtoHref(
        to,
        subject,
        // eslint-disable-next-line i18next/no-literal-string
        body + "\nPage: " + pageUrl
      )
    : mailtoHref(to, subject, body);
  if (page.length <= MAILTO_LIMIT) {
    return page;
  }
  return mailtoHref(to, subject, body);
}

export interface ProjectContact {
  name: string;
  email: string;
}
