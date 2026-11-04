import crypto from "crypto";
import { Client } from "pg";
import { databaseURL } from "./config";

/**
 * Remove a journey's project for real. GraphQL delete_project only marks the
 * row deleted and keeps the slug.
 */
export async function hardDeleteProject(slug: string) {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id FROM projects WHERE slug = $1", [
      slug,
    ]);
    if (found.rowCount === 0) {
      await client.query("ROLLBACK");
      return;
    }
    const id = found.rows[0].id;
    // These foreign keys are NO ACTION. Everything else that references
    // projects cascades.
    for (const table of [
      "offline_tile_packages",
      "project_map_data_requests",
      "project_visitor_metrics",
      "project_activity",
      "community_guidelines",
      "offline_tile_settings",
      "project_visitors",
    ]) {
      await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [id]);
    }
    await client.query("DELETE FROM projects WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * The same invite, signed again so `exp` is already past. Verification still
 * uses the key that issued the original token, and returns "jwt expired".
 */
export async function expireInviteToken(token: string): Promise<string> {
  const [headerPart, payloadPart] = token.split(".");
  if (!headerPart || !payloadPart) {
    throw new Error("Invite token is not a JWT");
  }
  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as {
    kid?: unknown;
  };
  if (typeof header.kid !== "string") {
    throw new Error("Invite token has no kid");
  }
  const claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
  claims.exp = Math.floor(Date.now() / 1000) - 120;

  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    const result = await client.query(`select private_pem from jwks where kid = $1`, [
      header.kid,
    ]);
    const pem = result.rows[0]?.private_pem;
    if (typeof pem !== "string") {
      throw new Error(`No signing key for invite kid ${header.kid}`);
    }
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const data = `${headerPart}.${payload}`;
    const signature = crypto.createSign("RSA-SHA256").update(data).sign(pem, "base64url");
    return `${data}.${signature}`;
  } finally {
    await client.end();
  }
}

/** Invite status after the recipient follows the emailed link. */
export async function projectInviteStatus(slug: string): Promise<string | null> {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    const result = await client.query(
      `select project_invites_status(pi.*) as status
       from project_invites pi
       join projects p on p.id = pi.project_id
       where p.slug = $1`,
      [slug]
    );
    const status = result.rows[0]?.status;
    return typeof status === "string" ? status : null;
  } finally {
    await client.end();
  }
}

export type DisposableUser = {
  sub: string;
  email: string;
  superuser: false;
};

/**
 * An account for one journey. Spec files run at the same time, so a journey
 * that changes a user's profile or joins a project as that user takes its
 * own account rather than the shared e2e|member persona.
 */
export function disposableUser(label: string): DisposableUser {
  const stamp = `${Date.now().toString(36)}-${crypto.randomBytes(2).toString("hex")}`;
  return {
    sub: `e2e|${label}-${stamp}`,
    email: `${label}-${stamp}@example.test`,
    superuser: false,
  };
}

/**
 * The row a first authenticated request would insert. Test mode only signs
 * tokens for users who already exist, and the suite does not sign up through
 * Auth0.
 */
export async function createE2EUser(sub: string, email: string) {
  assertDisposableE2ESub(sub);
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query(`select get_or_create_user_by_sub($1, $2)`, [sub, email]);
  } finally {
    await client.end();
  }
}

/**
 * Remove a user this journey created, with the forum posts they wrote.
 * Seed personas are refused.
 */
export async function deleteE2EUser(sub: string) {
  assertDisposableE2ESub(sub);
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id FROM users WHERE sub = $1", [sub]);
    if (found.rowCount === 0) {
      await client.query("ROLLBACK");
      return;
    }
    const id = found.rows[0].id;
    // These foreign keys are NO ACTION. The rest cascade from users.
    await client.query("DELETE FROM posts WHERE author_id = $1", [id]);
    await client.query("DELETE FROM topics WHERE author_id = $1", [id]);
    await client.query("DELETE FROM pending_topic_notifications WHERE user_id = $1", [id]);
    await client.query("DELETE FROM topic_notification_unsubscribes WHERE user_id = $1", [id]);
    await client.query("DELETE FROM users WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

function assertDisposableE2ESub(sub: string) {
  if (!sub.startsWith("e2e|") || sub === "e2e|member" || sub === "e2e|admin") {
    throw new Error(`Refusing to create or delete ${sub}`);
  }
}

/**
 * Put a user back to never having been asked about the AI Cartographer, so
 * an upload journey always gets the first-upload prompt and decides for
 * itself. The choice is per account and persists in the e2e database
 * between journeys and reruns.
 */
export async function resetAiCartographerChoice(sub: string) {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query(
      `update user_profiles
       set enable_ai_data_analyst = false,
           ai_data_analyst_enabled_at = null,
           was_prompted_to_enable_ai_data_analyst_at = null
       where user_id = (select id from users where sub = $1)`,
      [sub]
    );
  } finally {
    await client.end();
  }
}