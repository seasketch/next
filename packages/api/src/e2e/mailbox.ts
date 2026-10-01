import fs from "fs";
import path from "path";

/** One JSON file per message, so a journey can open the link without SES. */
export function writeE2EEmail(
  destination: string,
  subject: string,
  htmlEmail: string,
  textEmail: string
) {
  const dir = path.join(process.cwd(), "e2e-emails");
  fs.mkdirSync(dir, { recursive: true });
  const safe = destination.replace(/[^a-z0-9.@_-]/gi, "_");
  const filename = `${Date.now()}-${safe}.json`;
  fs.writeFileSync(
    path.join(dir, filename),
    JSON.stringify({ destination, subject, htmlEmail, textEmail }, null, 2)
  );
  return filename;
}
