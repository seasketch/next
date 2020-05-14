import { sql, DatabaseTransactionConnectionType } from "slonik";
import shortid from "shortid";

export async function createUser(conn: DatabaseTransactionConnectionType) {
  const sub = `test:${shortid()}`;
  const id = await conn.oneFirst(sql`select get_or_create_user_by_sub(${sub})`);
  return id as number;
}

export async function createProject(
  conn: DatabaseTransactionConnectionType,
  adminId: number,
  accessControl = "admins_only"
) {
  await createSession(conn, adminId);
  const slug = `${shortid()}`;
  const id = await conn.oneFirst(
    sql`select id from create_project(${slug}, ${slug})`
  );
  if (accessControl === "admins_only") {
    await conn.any(
      sql`update projects set access_control = ${accessControl} where id = ${id}`
    );
  } else {
    await conn.any(
      sql`update projects set access_control = ${accessControl}, is_listed = true where id = ${id}`
    );
  }
  await clearSession(conn);
  return id as number;
}

export async function createSession(
  conn: DatabaseTransactionConnectionType,
  userId?: number,
  emailVerified = true,
  superuser = false,
  projectId?: number
) {
  if (superuser) {
    await conn.any(sql`SET ROLE seasketch_superuser`);
  } else if (userId) {
    await conn.any(sql`SET ROLE seasketch_user`);
  }
  if (emailVerified) {
    await conn.any(
      sql`select set_config('session.email_verified', ${true}, true)`
    );
  }
  if (userId) {
    await conn.any(sql`select set_config('session.user_id', ${userId}, true)`);
  } else {
    await conn.any(sql`SET ROLE anon`);
  }
  if (projectId) {
    await conn.any(
      sql`select set_config('session.project_id', ${projectId}, true)`
    );
  }
}

export async function clearSession(conn: DatabaseTransactionConnectionType) {
  await conn.any(
    sql`select set_config('session.project_id', ${null}, true), set_config('session.user_id', ${null}, true)`
  );
  await conn.any(sql`set role postgres`);
}

export async function addParticipant(
  conn: DatabaseTransactionConnectionType,
  userId: number,
  projectId: number,
  isAdmin = false,
  shareProfile = true,
  approved = false
) {
  return conn.any(
    sql`insert into project_participants (
      user_id, 
      project_id, 
      is_admin, 
      share_profile,
      approved
    ) values (
      ${userId}, 
      ${projectId}, 
      ${isAdmin}, 
      ${shareProfile},
      ${approved}
    )`
  );
}
