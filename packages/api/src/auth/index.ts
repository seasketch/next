import { IncomingMessage, IncomingHttpHeaders } from "http";
import pool from "../pool";

export type Role = "anon" | "seasketch_user" | "seasketch_superuser";

export interface PGSessionSettings {
  role: Role;
  "session.project_id"?: number;
  "session.email_verified": boolean;
  "session.user_id"?: number;
  [key: string]: any;
}

const defaults = {
  statement_timeout: "1000",
  role: "anon",
  "session.email_verified": false,
} as PGSessionSettings;

export interface IncomingRequest extends IncomingMessage {
  user?: {
    permissions: string[];
    sub: string;
    "https://seasketch.org/email_verified"?: boolean;
  };
}

export async function getPGSessionSettings(req: IncomingRequest) {
  if (req.user) {
    const slug = getSlug(req.headers);
    const [projectId, userId] = await Promise.all([
      getProjectIdFromHeaders(slug),
      getOrCreateUserId(req.user.sub),
    ]);
    let role: Role = "anon";
    if ((req.user.permissions || []).indexOf("superuser") !== -1) {
      role = "seasketch_superuser";
    } else if (projectId && userId) {
      role = "seasketch_user";
    }
    return {
      ...defaults,
      "session.email_verified": !!req.user[
        "https://seasketch.org/email_verified"
      ],
      "session.project_id": projectId,
      "session.user_id": userId,
      role,
    };
  } else {
    return defaults;
  }
}

function getSlug(headers: IncomingHttpHeaders) {
  let slug: string;
  if (headers["x-ss-slug"]) {
    slug = Array.isArray(headers["x-ss-slug"])
      ? headers["x-ss-slug"][0]
      : headers["x-ss-slug"];
  } else if (headers["referer"]) {
    const url = new URL(headers["referer"]);
    slug = url.pathname.split("/")[0];
  } else {
    throw new Error("No referer or x-ss-slug header found");
  }
  return slug;
}

// TODO: cache these getters ( but be sure to expire them appropriately )

async function getProjectIdFromHeaders(slug: string): Promise<number> {
  const results = await pool.query(`select id from projects where slug = $1`, [
    slug,
  ]);
  if (results.rowCount === 0) {
    throw new Error(`Session error. Unknown project ${slug}`);
  } else {
    return results.rows[0].id;
  }
}

async function getOrCreateUserId(sub: string): Promise<number> {
  const results = await pool.query(`select get_or_create_user_by_sub($1)`, [
    sub,
  ]);
  if (results.rowCount === 0 || !results.rows[0].get_or_create_user_by_sub) {
    throw new Error(`Session error. Unknown user ${sub}`);
  } else {
    return results.rows[0].get_or_create_user_by_sub;
  }
}
