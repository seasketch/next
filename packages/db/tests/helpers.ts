import {
  sql,
  DatabaseTransactionConnectionType,
  DatabasePoolType,
} from "slonik";
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

export async function createGroup(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  name?: string,
  participantIds?: [number]
) {
  const groupId = await conn.oneFirst(
    sql`insert into project_groups (project_id, name) values (${projectId}, ${
      name || shortid()
    }) returning id`
  );
  if (participantIds) {
    const participantRecords = participantIds.map(
      (userId) => sql`(${groupId}, ${userId})`
    );
    for (const id of participantIds) {
      await conn.any(sql`select add_user_to_group(${groupId}, ${id})`);
    }
  }
  return groupId as number;
}

export function addGroupToAcl(
  conn: DatabaseTransactionConnectionType,
  aclId: number,
  groupId: number
) {
  return conn.any(sql`select add_group_to_acl(${aclId}, ${groupId})`);
}

export function projectTransaction(
  pool: DatabasePoolType,
  accessControl: "invite_only" | "admins_only" | "public",
  fn: (
    connection: DatabaseTransactionConnectionType,
    projectId: number,
    adminId: number,
    userIds: [number, number]
  ) => Promise<void>
) {
  return pool.transaction(async (conn) => {
    const adminId = await createUser(conn);
    const projectId = await createProject(conn, adminId, accessControl);
    const userA = await createUser(conn);
    const userB = await createUser(conn);
    if (accessControl === "invite_only") {
      addParticipant(conn, userA, projectId, false, true, true);
      addParticipant(conn, userB, projectId, false, true, true);
    }
    await fn(conn, projectId, adminId, [userA, userB]);
    await conn.any(sql`ROLLBACK`);
  });
}

export async function verifyOnlyAuthorsCanEditRecords(
  pool: DatabasePoolType,
  tableName: string,
  record: { [column: string]: any }
) {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, [user1, user2]) => {
      // create records for both user1 and user2
      const item1 = await createRecord(
        conn,
        tableName,
        record,
        projectId,
        user1
      );
      const item2 = await createRecord(
        conn,
        tableName,
        record,
        projectId,
        user2
      );
      // identify attribute that can be changed
      let attr: string | null = null;
      for (const key in record) {
        if (typeof record[key] === "string" && !/^:/.test(record[key])) {
          attr = key;
        }
      }
      if (attr === null) {
        throw new Error(
          "Could not identify string attribute to modify for test case"
        );
      }
      const col = sql.identifier([attr]);
      const table = sql.identifier([tableName]);
      // verify user1 can update their own records
      await createSession(conn, user1, true, false, projectId);
      const newValue = await conn.oneFirst(
        sql`update ${table} set ${col} = ${
          record[attr] + " (updated)"
        } where id = ${item1} returning ${col}`
      );
      expect(newValue).toBe(record[attr] + " (updated)");
      // verify that user2 can't update user1's
      await createSession(conn, user1, true, false, projectId);
      expect(
        conn.oneFirst(
          sql`update ${table} set ${col} = ${
            record[attr] + " (updated)"
          } where id = ${item1}`
        )
      ).rejects.toThrow();
      // verify user1 can delete their own records
      expect(
        await conn.oneFirst(
          sql`delete from ${table} where id = ${item1} returning id`
        )
      ).toBeTruthy();
      // verify user1 can't delete user2's
      expect(
        conn.oneFirst(
          sql`delete from ${table} where id = ${item2} returning id`
        )
      ).rejects.toThrow();
      // verify an admin or superuser can't delete user2's
      await createSession(conn, adminId, true, true, projectId);
      expect(
        conn.oneFirst(
          sql`delete from ${table} where id = ${item2} returning id`
        )
      ).rejects.toThrow();
    }
  );
}

export async function verifyOnlyAuthorsCanAccessRecords(
  pool: DatabasePoolType,
  tableName: string,
  record: { [column: string]: any }
) {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, userIds) => {
      // Create records for 2 users, one with 2 items and one with 1
      const item1 = await createRecord(
        conn,
        tableName,
        record,
        projectId,
        userIds[0]
      );
      const item2 = await createRecord(
        conn,
        tableName,
        record,
        projectId,
        userIds[0]
      );
      const item3 = await createRecord(
        conn,
        tableName,
        record,
        projectId,
        userIds[1]
      );
      // Select these records for userB with 1 record, and verify the count and id
      await createSession(conn, userIds[1], true, false, projectId);
      const id = await conn.oneFirst(
        sql`select id from ${sql.identifier([tableName])} ${
          record["project_id"] ? sql`where project_id = ${projectId}` : sql``
        }`
      );
      expect(id).toBe(item3);
      // Verify that the admin cannot select these records
      await createSession(conn, adminId, true, false, projectId);
      const rows = await conn.any(
        sql`select id from ${sql.identifier([tableName])} ${
          record["project_id"] ? sql`where project_id = ${projectId}` : sql``
        }`
      );
      expect(rows.length).toBe(0);
      // Verify that the other user cannot select these records
      await createSession(conn, userIds[0], true, false, projectId);
      expect(
        (
          await conn.any(
            sql`select id from ${sql.identifier([
              tableName,
            ])} where id = ${item3} ${
              record["project_id"] ? sql`and project_id = ${projectId}` : null
            }`
          )
        ).length
      ).toBe(0);
    }
  );
}

async function createRecord(
  conn: DatabaseTransactionConnectionType,
  tableName: string,
  record: { [column: string]: any },
  projectId: number,
  userId: number
) {
  await createSession(conn, userId, true, false, projectId);
  record = { ...record };
  for (const key of Object.keys(record)) {
    if (record[key] === ":project_id") {
      record[key] = projectId;
    }
    if (record[key] === ":user_id") {
      record[key] = userId;
    }
  }
  const id = await conn.oneFirst(
    sql`insert into ${sql.identifier([tableName])} (${sql.join(
      Object.keys(record).map((k) => sql.identifier([k])),
      sql`,`
    )}) values (${sql.join(
      Object.values(record).map((v) => sql`${v}`),
      sql`,`
    )}) returning id`
  );
  await clearSession(conn);
  return id;
}
