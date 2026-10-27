import fs from "fs";
import path from "path";

const mailboxDir = path.resolve(__dirname, "../../api/e2e-emails");

type Mail = {
  destination?: string;
  textEmail?: string;
};

/**
 * The API writes invite mail here instead of calling SES. The link in the
 * file uses CLIENT_DOMAIN, which is https and not the dev server, so the
 * journey follows the path on the Playwright base URL.
 */
export async function waitForInvitePath(
  destination: string,
  projectName: string,
  sentAt: number
): Promise<string> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const invitePath = readInvitePath(destination, projectName, sentAt);
    if (invitePath) {
      return invitePath;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `No invite email for ${destination} mentioning ${projectName} in ${mailboxDir}`
  );
}

/** Token query param on a path from `waitForInvitePath`. */
export function inviteToken(invitePath: string): string {
  const token = new URL(invitePath, "http://localhost").searchParams.get("token");
  if (!token) {
    throw new Error(`Invite path has no token: ${invitePath}`);
  }
  return token;
}

function readInvitePath(
  destination: string,
  projectName: string,
  sentAt: number
): string | null {
  if (!fs.existsSync(mailboxDir)) {
    return null;
  }
  let newest: { mtimeMs: number; invitePath: string } | null = null;
  for (const file of fs.readdirSync(mailboxDir)) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const filePath = path.join(mailboxDir, file);
    const mtimeMs = fs.statSync(filePath).mtimeMs;
    // Older runs leave mail for the same project name. Ignore those.
    if (mtimeMs + 1000 < sentAt) {
      continue;
    }
    const mail = JSON.parse(fs.readFileSync(filePath, "utf8")) as Mail;
    if (mail.destination !== destination || !mail.textEmail?.includes(projectName)) {
      continue;
    }
    const match = mail.textEmail.match(
      /https?:\/\/\S+(\/auth\/projectInvite\?token=\S+)/
    );
    if (match && (!newest || mtimeMs > newest.mtimeMs)) {
      newest = { mtimeMs, invitePath: match[1] };
    }
  }
  return newest?.invitePath ?? null;
}
