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

/** Remove a user this journey created. Seed personas are refused. */
export async function deleteE2EUser(sub: string) {
  assertDisposableE2ESub(sub);
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query(`delete from users where sub = $1`, [sub]);
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
 * The forum journey expects e2e|member's full name to be empty. Access
 * journeys that submit the profile form put it back.
 */
export async function clearMemberProfile() {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query(
      `update user_profiles
       set fullname = null, nickname = null, email = null, affiliations = null
       where user_id = (select id from users where sub = 'e2e|member')`
    );
  } finally {
    await client.end();
  }
}
