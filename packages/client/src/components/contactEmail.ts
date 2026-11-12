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

export function mailtoHref(email: string, subject?: string) {
  // eslint-disable-next-line i18next/no-literal-string
  const href = "mailto:" + email;
  if (!subject) {
    return href;
  }
  // eslint-disable-next-line i18next/no-literal-string
  return href + "?subject=" + encodeURIComponent(subject);
}

export interface ProjectContact {
  name: string;
  email: string;
}
