import Papa from "papaparse";

export const USER_CSV_COLUMNS = [
  "Name",
  "Nickname",
  "Email",
  "Canonical Email",
  "Admin",
  "Groups",
  "Banned from Forums",
  "Onboarded",
  "Access Status",
  "Approved By",
  "Denied By",
  "Approved or Denied On",
] as const;

export const INVITE_CSV_COLUMNS = [
  "Name",
  "Email",
  "Status",
  "Admin",
  "Groups",
  "Created At",
  "Used",
] as const;

type GroupLike = { name?: string | null } | null;

export type UserCsvSource = {
  isAdmin?: boolean | null;
  canonicalEmail?: string | null;
  bannedFromForums?: boolean | null;
  onboarded?: string | null;
  needsAccessRequestApproval?: boolean | null;
  approvedOrDeniedOn?: string | null;
  groups?: Array<GroupLike> | null;
  approvedBy?: { canonicalEmail?: string | null } | null;
  deniedBy?: { canonicalEmail?: string | null } | null;
  profile?: {
    email?: string | null;
    fullname?: string | null;
    nickname?: string | null;
  } | null;
};

export type InviteCsvSource = {
  email: string;
  fullname?: string | null;
  status?: string | null;
  makeAdmin?: boolean | null;
  wasUsed?: boolean | null;
  createdAt?: string | null;
  groups?: Array<GroupLike> | null;
};

export function usersToCsv(users: UserCsvSource[]): string {
  const data = users.map((user) => ({
    Name: user.profile?.fullname || "",
    Nickname: user.profile?.nickname || "",
    Email: user.profile?.email || "",
    "Canonical Email": user.canonicalEmail || "",
    Admin: yesNo(user.isAdmin),
    Groups: formatGroups(user.groups),
    "Banned from Forums": yesNo(user.bannedFromForums),
    Onboarded: formatDate(user.onboarded),
    "Access Status": accessStatus(user),
    "Approved By": user.approvedBy?.canonicalEmail || "",
    "Denied By": user.deniedBy?.canonicalEmail || "",
    "Approved or Denied On": formatDate(user.approvedOrDeniedOn),
  }));
  return Papa.unparse(
    {
      fields: [...USER_CSV_COLUMNS],
      data,
    },
    {
      header: true,
      quotes: true,
      newline: "\n",
    }
  );
}

export function invitesToCsv(invites: InviteCsvSource[]): string {
  const data = invites.map((invite) => ({
    Name: invite.fullname || "",
    Email: invite.email || "",
    Status: formatInviteStatus(invite.status),
    Admin: yesNo(invite.makeAdmin),
    Groups: formatGroups(invite.groups),
    "Created At": formatDate(invite.createdAt),
    Used: yesNo(invite.wasUsed),
  }));
  return Papa.unparse(
    {
      fields: [...INVITE_CSV_COLUMNS],
      data,
    },
    {
      header: true,
      quotes: true,
      newline: "\n",
    }
  );
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeFilename(filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* eslint-disable i18next/no-literal-string */
export function usersExportFilename(options: {
  slug: string;
  groupName?: string;
  adminsOnly?: boolean;
  accessRequests?: boolean;
}): string {
  const slug = sanitizeFilenamePart(options.slug);
  if (options.groupName) {
    return `${slug}-${sanitizeFilenamePart(options.groupName)}-users.csv`;
  }
  if (options.adminsOnly) {
    return `${slug}-admins.csv`;
  }
  if (options.accessRequests) {
    return `${slug}-access-requests.csv`;
  }
  return `${slug}-users.csv`;
}

export function invitesExportFilename(slug: string, status: string[]): string {
  const safeSlug = sanitizeFilenamePart(slug);
  if (status.length === 1 && status[0] === "UNSENT") {
    return `${safeSlug}-invites-draft.csv`;
  }
  if (status.includes("BOUNCED")) {
    return `${safeSlug}-invites-problems.csv`;
  }
  if (status.includes("SENT") || status.includes("QUEUED")) {
    return `${safeSlug}-invites-sent.csv`;
  }
  return `${safeSlug}-invites.csv`;
}
/* eslint-enable i18next/no-literal-string */

export function sanitizeFilenamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "export"
  );
}

export function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim() || "export.csv";
  const lastDot = trimmed.lastIndexOf(".");
  const hasExtension = lastDot > 0;
  const base = hasExtension ? trimmed.slice(0, lastDot) : trimmed;
  const extension = hasExtension ? trimmed.slice(lastDot) : ".csv";
  return `${sanitizeFilenamePart(base)}${extension}`;
}

export function formatInviteStatus(status?: string | null): string {
  if (!status) {
    return "";
  }
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function yesNo(value?: boolean | null): string {
  return value ? "Yes" : "No";
}

function formatGroups(groups?: Array<GroupLike> | null): string {
  return (groups || [])
    .map((group) => group?.name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b))
    .join("; ");
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString();
}

function accessStatus(user: UserCsvSource): string {
  if (user.deniedBy) {
    return "Denied";
  }
  if (user.needsAccessRequestApproval) {
    return "Needs approval";
  }
  if (user.approvedBy) {
    return "Approved";
  }
  return "";
}
