import MockSES from "aws-sdk/clients/ses";
import {
  sql,
  DatabaseTransactionConnectionType,
  DatabasePoolType,
  QueryResultRowColumnType,
  SqlTaggedTemplateType,
  SqlSqlTokenType,
  QueryResultType,
} from "slonik";
import shortid from "shortid";
import { QueryResult } from "pg";
// @ts-ignore
import { raw } from "slonik-sql-tag-raw";
import { sendQueuedSurveyInvites } from "../src/invites/surveyInvites";
import auth0 from "auth0";
jest.mock("auth0");
// @ts-ignore
auth0.ManagementClient.prototype.updateUser = jest.fn(() => {});
// @ts-ignore
auth0.ManagementClient.prototype.getUsers = jest.fn((val) => {
  const subs = val?.q?.match(/"[^"]+"/g)?.map((v) => v.replace(/"/g, ""));
  if (subs && subs.length) {
    return subs.map((sub) => {
      return {
        user_id: sub,
        email: `${sub.replace(/[^\w]/g, "")}@example.com`,
      };
    });
  } else {
    return [];
  }
});
jest.mock("aws-sdk/clients/ses", () => {
  const mSES = {
    sendBulkTemplatedEmail: jest.fn().mockReturnThis(),
    promise: jest.fn(),
  };
  return jest.fn(() => mSES);
});

export async function createUser(conn: DatabaseTransactionConnectionType) {
  const sub = `test:${shortid()}`;
  const canonicalEmail = `${shortid()}@example.com`;
  const id = await conn.oneFirst(
    sql`select get_or_create_user_by_sub(${sub}, ${canonicalEmail})`
  );
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
  projectId?: number,
  ip = "128.111.0.1"
) {
  if (superuser) {
    await conn.any(sql`SET ROLE seasketch_superuser`);
  } else if (userId) {
    await conn.any(sql`SET ROLE seasketch_user`);
  }
  await conn.any(sql`select set_config('session.request_ip', ${ip}, ${true})`);
  if (emailVerified) {
    await conn.any(
      sql`select set_config('session.email_verified', ${true}, true)`
    );
  } else {
    await conn.any(
      sql`select set_config('session.email_verified', ${false}, true)`
    );
  }
  if (userId) {
    await conn.any(sql`select set_config('session.user_id', ${userId}, true)`);
    // console.log("set session.canonical_email", `test-${userId}@example.com`);
    await conn.any(
      sql`select set_config('session.canonical_email', ${`test-${userId}@example.com`}, true)`
    );
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
      await addParticipant(conn, userA, projectId, false, true, true);
      await addParticipant(conn, userB, projectId, false, true, true);
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
      await conn.any(sql`SAVEPOINT before_update`);
      expect(
        conn.oneFirst(
          sql`update ${table} set ${col} = ${
            record[attr] + " (updated)"
          } where id = ${item1}`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK to before_update`);
      // verify user1 can delete their own records
      expect(
        await conn.oneFirst(
          sql`delete from ${table} where id = ${item1} returning id`
        )
      ).toBeTruthy();
      // verify user1 can't delete user2's
      await conn.any(sql`SAVEPOINT before_delete`);
      expect(
        conn.oneFirst(
          sql`delete from ${table} where id = ${item2} returning id`
        )
      ).rejects.toThrow();
      await conn.any(sql`ROLLBACK to before_delete`);
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

// export async function verify

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

export async function verifyOnlyProjectGroupMembersCanAccessResource(
  pool: DatabasePoolType,
  tableName: string,
  fn: (
    connection: DatabaseTransactionConnectionType,
    projectId: number,
    groupId: number,
    adminId: number
  ) => Promise<number>
) {
  await projectTransaction(
    pool,
    "invite_only",
    async (conn, projectId, adminId, [userA, userB]) => {
      const nonParticipant = await createUser(conn);
      await createSession(conn, adminId, true, false, projectId);
      const groupId = await createGroup(conn, projectId, "group a", [userA]);
      const groupBId = await createGroup(conn, projectId, "group b", [userB]);
      const id = await fn(conn, projectId, groupId, adminId);
      // admin can select object
      await createSession(conn, adminId, true, false, projectId);
      let selectedId = await conn.oneFirst(
        sql`select id from ${sql.identifier([tableName])} where id = ${id}`
      );
      expect(selectedId).toBe(id);
      // nonParticipant cannot
      await createSession(conn, nonParticipant, true, false, projectId);
      let count = await conn.oneFirst(
        sql`select count(id) from ${sql.identifier([
          tableName,
        ])} where id = ${id}`
      );
      expect(count).toBe(0);
      // userA in group a can select object
      await clearSession(conn);
      await createSession(conn, userA, true, false, projectId);
      count = await conn.oneFirst(
        sql`select count(id) from ${sql.identifier([
          tableName,
        ])} where id = ${id}`
      );
      expect(count).toBe(1);
      // userB cannot
      await createSession(conn, userB, true, false, projectId);
      count = await conn.oneFirst(
        sql`select count(id) from ${sql.identifier([
          tableName,
        ])} where id = ${id}`
      );
      expect(count).toBe(0);
    }
  );
}

export async function limitToGroup(
  conn: DatabaseTransactionConnectionType,
  relColumnName: string,
  recordId: number | QueryResultRowColumnType,
  groupId: number
) {
  const aclId = await conn.oneFirst(
    sql`update access_control_lists set type = 'group' where ${sql.identifier([
      relColumnName,
    ])} = ${recordId} returning id`
  );
  return addGroupToAcl(conn, aclId as number, groupId);
}

type verifyCRUDOpsLimitedToAdminsOptions = {
  setup?: (
    conn: DatabaseTransactionConnectionType,
    projectId: number,
    adminId: number,
    userIds: [number, number]
  ) => Promise<void>;
  create: (
    conn: DatabaseTransactionConnectionType,
    projectId: number,
    adminId: number,
    userIds: [number, number]
  ) => Promise<SqlSqlTokenType>;
  update: ((recordId: number) => SqlSqlTokenType) | false;
  delete: (recordId: number) => SqlSqlTokenType;
};

export async function verifyCRUDOpsLimitedToAdmins(
  pool: DatabasePoolType,
  options: verifyCRUDOpsLimitedToAdminsOptions
) {
  await projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, userIds) => {
      const [userA, userB] = userIds;
      if (options.setup) {
        await options.setup(conn, projectId, adminId, userIds);
      }
      const projectBId = await createProject(conn, userB, "public");
      await createSession(conn, adminId, true, false, projectId);
      const createSql = await options.create(conn, projectId, adminId, userIds);
      await createSession(conn, userB, true, false, projectBId);
      await conn.any(sql`SAVEPOINT before_create`);
      expect(conn.one(createSql)).rejects.toThrow();
      await conn.any(sql`ROLLBACK to before_create`);
      await createSession(conn, adminId, true, false, projectId);
      const record = await conn.one(createSql);
      expect(record).toBeTruthy();
      if (options.update !== false) {
        const updateSql = await options.update(record.id as number);
        await createSession(conn, userB, true, false, projectBId);
        await conn.any(sql`SAVEPOINT before_update`);
        expect(conn.one(updateSql)).rejects.toThrow();
        await conn.any(sql`ROLLBACK to before_update`);
        await createSession(conn, adminId, true, false, projectId);
        const updated = await conn.one(updateSql);
        expect(updated).toBeTruthy();
      }
      const deleteSql = await options.delete(record.id as number);
      await conn.any(sql`SAVEPOINT before_delete`);
      await createSession(conn, userB, true, false, projectBId);
      expect(conn.one(deleteSql)).rejects.toThrow();
      await conn.any(sql`ROLLBACK to before_delete`);
      await createSession(conn, adminId, true, false, projectId);
      await conn.any(deleteSql);
    }
  );
}

export function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export const asPg = (pool: DatabaseTransactionConnectionType) => {
  return {
    query: (query: string, values?: any[]) => {
      return pool.query(
        sql`${raw(query, values)}`
      ) as unknown as Promise<QueryResult>;
    },
  };
};

export async function addUserToGroup(
  conn: DatabaseTransactionConnectionType,
  userId: number,
  groupId: number
): Promise<void> {
  await conn.any(sql`select add_user_to_group(${groupId}, ${userId})`);
  return;
}

export async function removeUserFromGroup(
  conn: DatabaseTransactionConnectionType,
  userId: number,
  groupId: number
): Promise<void> {
  await conn.any(sql`select remove_user_from_group(${groupId}, ${userId})`);
  return;
}

export async function createAndSendSurveyInvite(
  pool: DatabasePoolType,
  accessType: "PUBLIC" | "INVITE_ONLY",
  callback: (
    conn: DatabaseTransactionConnectionType,
    projectId: number,
    adminId: number,
    userA: number,
    surveyId: number,
    inviteId: number
  ) => Promise<void>
) {
  return projectTransaction(
    pool,
    "public",
    async (conn, projectId, adminId, [userA, userB]) => {
      await createSession(conn, adminId, true, false);
      const templateExists = await conn.oneFirst(
        sql`select count(id) from forms where template_name = 'Basic Template'`
      );
      if (!templateExists) {
        await pool.any(
          sql`insert into forms (is_template, template_name, template_type) values (true, 'Basic Template', 'SURVEYS') returning id`
        );
      }
      const surveyId = await conn.oneFirst<number>(
        sql`select id from make_survey('Survey', ${projectId}, null)`
      );
      const formId = await conn.oneFirst(
        sql`select id from forms where survey_id = ${surveyId}`
      );
      await conn.any(
        sql`update surveys set access_type = ${accessType} where id = ${surveyId}`
      );
      await conn.any(
        sql`update surveys set is_disabled = ${false} where id = ${surveyId}`
      );
      const invite = await conn.one(
        sql`select * from create_survey_invites(${surveyId}, false, null, null, array[
                      ('bob@example.com', 'Bob')::survey_invite_options
                    ])`
      );
      const mock = new MockSES();
      mock
        .sendBulkTemplatedEmail()
        // @ts-ignore
        .promise.mockImplementationOnce((d) => {
          return {
            Status: [
              {
                Status: "Success",
                MessageId: "123abc",
              },
            ],
          };
        });
      await clearSession(conn);
      await sendQueuedSurveyInvites(asPg(conn));
      await callback(
        conn,
        projectId,
        adminId,
        userA,
        surveyId,
        invite.id as number
      );
    }
  );
}

export async function verifySessionCanAccessSurveyResources(
  conn: DatabaseTransactionConnectionType,
  projectId: number,
  surveyId: number,
  formId: number,
  fieldId: number,
  ruleId: number
) {
  // verify user can
  //   * access the project
  //   * access the survey
  //   * access related forms
  //   * access related fields
  //   * access field rules
  //   * TODO: access related sketch classes and data layers
  //   * TODO: access related sketch classes' forms, fields, and rules
  expect(
    (await conn.any(sql`select name from projects where id = ${projectId}`))
      .length
  ).toBe(1);
  expect(
    (await conn.any(sql`select name from surveys where id = ${surveyId}`))
      .length
  ).toBe(1);
  expect(
    (await conn.any(sql`select 1 from forms where id = ${formId}`)).length
  ).toBe(1);
  expect(
    (await conn.any(sql`select 1 from form_elements where id = ${fieldId}`))
      .length
  ).toBe(1);
  expect(
    (
      await conn.any(
        sql`select 1 from form_conditional_rendering_rules where id = ${ruleId}`
      )
    ).length
  ).toBe(1);
}

/**
 * Creates a prosemirror document containing a single header from the given string
 * @param str
 * @returns sql.json object
 */
export function createBody(str: string) {
  return sql.json({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ text: str, type: "text" }],
      },
    ],
  });
}

/**
 * Assuming a document created by #createBody, will return the header string
 * @param body
 * @returns string
 */
export function getBodyStr(body: any) {
  return body.content[0].content[0].text;
}
