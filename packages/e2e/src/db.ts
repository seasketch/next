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

/**
 * Closed change_log rows for a project, newest first. Rows come in groups of
 * five that share a timestamp, so cursor paging has to break ties on id.
 * `netZeroCount` extra rows have identical from/to values and must never be
 * listed. Returns the number of visible rows.
 */
export async function seedProjectChangeLogs(
  slug: string,
  options: { count: number; netZeroCount?: number }
) {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    const project = await client.query(
      `select id from projects where slug = $1`,
      [slug]
    );
    const editor = await client.query(
      `select id from users where sub = 'e2e|admin'`
    );
    const projectId = project.rows[0].id as number;
    const editorId = editor.rows[0].id as number;
    await client.query(`delete from change_logs where project_id = $1`, [
      projectId,
    ]);
    await client.query(
      `insert into change_logs (project_id, editor_id, started_at, last_at, status, from_summary, to_summary, entity_id, entity_type, field_group)
       select $1, $2, ts, ts, 'closed',
         case when n % 3 = 0 then '{}'::jsonb else jsonb_build_object('title', 'Before ' || n) end,
         case when n % 3 = 0 then jsonb_build_object('layer_count', n) else jsonb_build_object('title', 'After ' || n) end,
         case when n % 3 = 0 then $1 else 800000 + n end,
         case when n % 3 = 0 then 'projects' else 'table_of_contents_items' end,
         (case when n % 3 = 0 then 'layers:published' else 'layer:title' end)::change_log_field_group
       from (
         select n, now() - (n / 5) * interval '53 minutes' - interval '1 second' as ts
         from generate_series(1, $3::int) n
       ) rows`,
      [projectId, editorId, options.count]
    );
    for (let i = 0; i < (options.netZeroCount ?? 0); i++) {
      await client.query(
        `insert into change_logs (project_id, editor_id, status, from_summary, to_summary, entity_id, entity_type, field_group)
         values ($1, $2, 'closed', '{"title":"Same"}', '{"title":"Same"}', 800000, 'table_of_contents_items', 'layer:title')`,
        [projectId, editorId]
      );
    }
    return options.count;
  } finally {
    await client.end();
  }
}

export type ProjectAccess = "public" | "invite_only" | "admins_only";

/** Patch the door directly. The visitor tests then reload. */
export async function setProject(
  slug: string,
  patch: { accessControl?: ProjectAccess; isListed?: boolean; isDeleted?: boolean }
) {
  const sets: string[] = [];
  const values: unknown[] = [slug];
  if (patch.accessControl) {
    values.push(patch.accessControl);
    sets.push(`access_control = $${values.length}::project_access_control_setting`);
  }
  if (patch.isListed !== undefined) {
    values.push(patch.isListed);
    sets.push(`is_listed = $${values.length}`);
  }
  if (patch.isDeleted !== undefined) {
    values.push(patch.isDeleted);
    sets.push(`is_deleted = $${values.length}`);
  }
  if (sets.length === 0) {
    return;
  }
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    const result = await client.query(
      `update projects set ${sets.join(", ")} where slug = $1`,
      values
    );
    if (result.rowCount === 0) {
      throw new Error(`No project ${slug}`);
    }
  } finally {
    await client.end();
  }
}

/**
 * A participant row, and a profile when a name is given so Access Requests
 * can list them. Arranged here so the journey does not click through admin.
 */
export async function upsertParticipant(input: {
  slug: string;
  sub: string;
  isAdmin?: boolean;
  approved?: boolean;
  shareProfile?: boolean;
  fullname?: string;
  email?: string;
}) {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query(
      `select id, canonical_email from users where sub = $1`,
      [input.sub]
    );
    const project = await client.query(`select id from projects where slug = $1`, [
      input.slug,
    ]);
    if (user.rowCount === 0) {
      throw new Error(`No user ${input.sub}`);
    }
    if (project.rowCount === 0) {
      throw new Error(`No project ${input.slug}`);
    }
    await client.query(
      `insert into project_participants (user_id, project_id, is_admin, approved, share_profile)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, project_id) do update
         set is_admin = excluded.is_admin,
             approved = excluded.approved,
             share_profile = excluded.share_profile`,
      [
        user.rows[0].id,
        project.rows[0].id,
        input.isAdmin === true,
        input.approved === true,
        input.shareProfile === true,
      ]
    );
    if (input.fullname) {
      await client.query(
        `insert into user_profiles (user_id, fullname, email)
         values ($1, $2, $3)
         on conflict (user_id) do update
           set fullname = excluded.fullname,
               email = excluded.email`,
        [
          user.rows[0].id,
          input.fullname,
          input.email ?? user.rows[0].canonical_email,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function participantCount(slug: string, sub: string): Promise<number> {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    const result = await client.query(
      `select count(*)::int as n
       from project_participants pp
       join projects p on p.id = pp.project_id
       join users u on u.id = pp.user_id
       where p.slug = $1 and u.sub = $2`,
      [slug, sub]
    );
    return result.rows[0].n as number;
  } finally {
    await client.end();
  }
}

export async function setShareProfile(slug: string, sub: string, shareProfile: boolean) {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    const result = await client.query(
      `update project_participants
       set share_profile = $3
       where project_id = (select id from projects where slug = $1)
         and user_id = (select id from users where sub = $2)`,
      [slug, sub, shareProfile]
    );
    if (result.rowCount === 0) {
      throw new Error(`No participant ${sub} on ${slug}`);
    }
  } finally {
    await client.end();
  }
}

/**
 * Two forums, each limited to its own group. The invite names `groupName`.
 * The other forum stays hidden from that person. Admins still see both.
 */
export async function seedGroupForums(slug: string): Promise<{
  groupName: string;
  forumName: string;
  otherForumName: string;
}> {
  const groupName = "Crew";
  const forumName = "Crew Forum";
  const otherForumName = "Other Forum";
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const project = await client.query(`select id from projects where slug = $1`, [slug]);
    if (project.rowCount === 0) {
      throw new Error(`No project ${slug}`);
    }
    const projectId = project.rows[0].id as number;
    const crew = await client.query(
      `insert into project_groups (project_id, name) values ($1, $2) returning id`,
      [projectId, groupName]
    );
    const other = await client.query(
      `insert into project_groups (project_id, name) values ($1, 'Others') returning id`,
      [projectId]
    );
    const crewForum = await client.query(
      `insert into forums (project_id, name, position) values ($1, $2, 0) returning id`,
      [projectId, forumName]
    );
    const otherForum = await client.query(
      `insert into forums (project_id, name, position) values ($1, $2, 1) returning id`,
      [projectId, otherForumName]
    );
    await grantForumToGroup(client, projectId, crewForum.rows[0].id, crew.rows[0].id);
    await grantForumToGroup(client, projectId, otherForum.rows[0].id, other.rows[0].id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
  return { groupName, forumName, otherForumName };
}

async function grantForumToGroup(
  client: Client,
  _projectId: number,
  forumId: number,
  groupId: number
) {
  // Creating a forum already inserts a public read ACL. Point that row at the group.
  const acl = await client.query(
    `update access_control_lists
     set type = 'group'
     where forum_id_read = $1
     returning id`,
    [forumId]
  );
  if (acl.rowCount === 0) {
    throw new Error(`No read ACL for forum ${forumId}`);
  }
  await client.query(
    `insert into access_control_list_groups (access_control_list_id, group_id)
     values ($1, $2)`,
    [acl.rows[0].id, groupId]
  );
}

export async function clearProjectChangeLogs(slug: string) {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query(
      `delete from change_logs where project_id = (select id from projects where slug = $1)`,
      [slug]
    );
  } finally {
    await client.end();
  }
}
