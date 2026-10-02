import crypto from "crypto";
import fs from "fs";
import path from "path";

/** One JSON file per message, so a journey can open the link without SES. */
export function writeE2EEmail(
  destination: string,
  subject: string,
  htmlEmail: string,
  textEmail: string,
  details: Record<string, unknown> = {}
) {
  const dir = path.join(process.cwd(), "e2e-emails");
  fs.mkdirSync(dir, { recursive: true });
  const safe = destination.replace(/[^a-z0-9.@_-]/gi, "_");
  const filename = `${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")}-${safe}.json`;
  fs.writeFileSync(
    path.join(dir, filename),
    JSON.stringify(
      { destination, subject, htmlEmail, textEmail, ...details },
      null,
      2
    )
  );
  return filename;
}
