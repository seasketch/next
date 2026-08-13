import { sql, DatabaseTransactionConnectionType } from "slonik";
import {
  createProject,
  createSession,
  createUser,
  uniqueEmail,
  uniqueId,
  uniqueSlug,
} from "./helpers";
import { createPool } from "./pool";

const pool = createPool("test");

async function insertUser(
  conn: DatabaseTransactionConnectionType,
  email = uniqueEmail()
) {
  const id = await conn.oneFirst<number>(
    sql`insert into users (sub, canonical_email) values (${uniqueId(
      "sub"
    )}, ${email}) returning id`
  );
  return { id, email };
}

async function insertProject(
  conn: DatabaseTransactionConnectionType,
  userId: number,
  email: string,
  options: {
    name?: string;
    slug?: string;
    isListed?: boolean;
    isDeleted?: boolean;
    accessControl?: string;
  } = {}
) {
  const slug = options.slug ?? uniqueSlug();
  const name = options.name ?? slug;
  const isListed = options.isListed ?? true;
  const isDeleted = options.isDeleted ?? false;
  const accessControl = options.accessControl;
  if (accessControl) {
    return conn.oneFirst<number>(
      sql`INSERT INTO projects (name, slug, is_listed, is_deleted, deleted_at, access_control, creator_id, support_email) values (${name}, ${slug}, ${isListed}, ${isDeleted}, ${
        isDeleted ? sql`now()` : sql`null`
      }, ${accessControl}, ${userId}, ${email}) returning id`
    );
  }
  return conn.oneFirst<number>(
    sql`INSERT INTO projects (name, slug, is_listed, is_deleted, deleted_at, creator_id, support_email) values (${name}, ${slug}, ${isListed}, ${isDeleted}, ${
      isDeleted ? sql`now()` : sql`null`
    }, ${userId}, ${email}) returning id`
  );
}

async function beginUserSession(
  conn: DatabaseTransactionConnectionType,
  userId: number,
  email: string,
  emailVerified = true
) {
  await conn.any(sql`select set_config('session.user_id', ${userId}, true)`);
  await conn.any(
    sql`select set_config('session.email_verified', ${emailVerified}, true)`
  );
  await conn.any(
    sql`select set_config('session.canonical_email', ${email}, true)`
  );
  await conn.any(sql`SET ROLE seasketch_user`);
}

describe("Access control", () => {
  describe("Listings", () => {
    test("Project admins can access unlisted projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await createUser(conn);
        await createSession(conn, userId, true, false);
        const pid = await createProject(conn, userId);
        await conn.any(
          sql`update projects set is_listed = false where id = ${pid}`
        );
        const count = await conn.oneFirst<number>(
          sql`select count(*) from projects where id = ${pid}`
        );
        expect(count).toBe(1);
        await conn.any(sql`ROLLBACK;`);
      });
    });
    test("Superusers can see all projects, even unlisted", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        const unlistedId = await insertProject(conn, userId, email, {
          isListed: false,
        });
        const listedId = await insertProject(conn, userId, email, {
          isListed: true,
        });
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const count = await conn.oneFirst(
          sql`select count(*) from projects where id in (${unlistedId}, ${listedId})`
        );
        expect(count).toBe(2);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Anonymous and unpriviledged users can only see listed projects", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        const unlistedId = await insertProject(conn, userId, email, {
          name: "unlisted",
          isListed: false,
        });
        const listedId = await insertProject(conn, userId, email, {
          name: "listed",
          isListed: true,
        });
        await conn.any(sql`SET ROLE anon`);
        const id = await conn.maybeOneFirst(
          sql`SELECT id from projects where id = ${unlistedId}`
        );
        expect(id).toBeNull();
        const visibleListedId = await conn.maybeOneFirst(
          sql`SELECT id from projects where id = ${listedId}`
        );
        expect(visibleListedId).not.toBeNull();
        await conn.any(sql`SET ROLE seasketch_user`);
        const name = await conn.oneFirst(
          sql`select name from projects where id = ${listedId}`
        );
        expect(name).toBe("listed");
        const listedCount = await conn.oneFirst(
          sql`select count(*) from projects where id in (${unlistedId}, ${listedId})`
        );
        expect(listedCount).toBe(1);
        await conn.any(sql`ROLLBACK;`);
      });
    });
  });

  describe("Project creation", () => {
    test("Nobody can directly insert records", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        await conn.any(sql`SET ROLE seasketch_superuser`);
        await expect(
          conn.any(
            sql`INSERT INTO projects (name, slug, creator_id, support_email) values (${uniqueSlug()}, ${uniqueSlug()}, ${userId}, ${email})`
          )
        ).rejects.toThrow(/denied/);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("createProject mutation inserts project and admin records", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        await beginUserSession(conn, userId, email);
        const slug = uniqueSlug();
        const pid = await conn.oneFirst(
          sql`select id from create_project(${slug}, ${slug})`
        );
        expect(pid).toBeGreaterThan(0);
        await conn.any(sql`SET ROLE postgres`);
        const count = await conn.oneFirst(
          sql`select count(*) from project_participants where user_id = ${userId} and project_id = ${pid} and is_admin = true`
        );
        expect(count).toBe(1);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("createProject creates owner record and populates support email", async () => {
      await pool.transaction(async (conn) => {
        const userId = await createUser(conn);
        await createSession(conn, userId, true);
        const pid = await createProject(conn, userId, "public");
        const { creator_id, support_email } = await conn.one(
          sql`select creator_id, support_email from projects where id = ${pid}`
        );
        expect(creator_id).toBe(userId);
        expect(support_email).toMatch(/test-\d+@example.com/);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("createProject can only be called if email is verified", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        await beginUserSession(conn, userId, email, false);
        const slug = uniqueSlug();
        expect(
          conn.oneFirst(sql`select id from create_project(${slug}, ${slug})`)
        ).rejects.toThrow(/email/i);
        await conn.any(sql`ROLLBACK;`);
      });
    });
    test("Anonymous users cannot create projects", async () => {
      await pool.transaction(async (conn) => {
        await conn.any(sql`SET ROLE seasketch_user`);
        const slug = uniqueSlug();
        expect(
          conn.oneFirst(sql`select id from create_project(${slug}, ${slug})`)
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });
  });

  describe("Project updates", () => {
    test("Superusers can update any project", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        const pid = await insertProject(conn, userId, email);
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const isFeatured = await conn.oneFirst(
          sql`update projects set is_featured = true where id = ${pid} returning is_featured`
        );
        expect(isFeatured).toBe(true);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Admins can update their own projects", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        await beginUserSession(conn, userId, email);
        const slug = uniqueSlug();
        const pid = await conn.oneFirst(
          sql`select id from create_project(${slug}, ${slug})`
        );
        const isListed = await conn.oneFirst(
          sql`update projects set is_listed = true where id = ${pid} returning is_listed`
        );
        expect(isListed).toBe(true);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Admins cannot update projects they don't own", async () => {
      await pool.transaction(async (conn) => {
        const userA = await insertUser(conn);
        const userB = await insertUser(conn);
        await beginUserSession(conn, userA.id, userA.email);
        const slugA = uniqueSlug();
        const pid = await conn.oneFirst(
          sql`select id from create_project(${slugA}, ${slugA})`
        );
        const isListed = await conn.oneFirst(
          sql`update projects set is_listed = true where id = ${pid} returning is_listed`
        );
        expect(isListed).toBe(true);
        await conn.any(
          sql`select set_config('session.canonical_email', ${userB.email}, true)`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userB.id}, true)`
        );
        const slugB = uniqueSlug();
        const pid2 = await conn.oneFirst(
          sql`select id from create_project(${slugB}, ${slugB})`
        );
        const isListed2 = await conn.oneFirst(
          sql`update projects set is_listed = true where id = ${pid2} returning is_listed`
        );
        expect(isListed2).toBe(true);
        expect(
          conn.oneFirst(
            sql`update projects set is_listed = true where id = ${pid} returning is_listed`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Anonymous users cannot update projects", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        await beginUserSession(conn, userId, email);
        const slug = uniqueSlug();
        const pid = await conn.oneFirst(
          sql`select id from create_project(${slug}, ${slug})`
        );
        await conn.any(sql`SET ROLE anon`);
        expect(
          conn.oneFirst(
            sql`update projects set is_listed = true where id = ${pid} returning is_listed`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Unpriviledged users cannot update projects", async () => {
      await pool.transaction(async (conn) => {
        const userA = await insertUser(conn);
        const userB = await insertUser(conn);
        await beginUserSession(conn, userA.id, userA.email);
        const slug = uniqueSlug();
        const pid = await conn.oneFirst(
          sql`select id from create_project(${slug}, ${slug})`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userB.id}, true)`
        );
        expect(
          conn.oneFirst(
            sql`update projects set is_listed = true where id = ${pid} returning is_listed`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("slug cannot be modified by superusers", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        const pid = await insertProject(conn, userId, email);
        await conn.any(sql`SET ROLE seasketch_superuser`);
        expect(
          conn.oneFirst(
            sql`update projects set slug = ${uniqueSlug()} where id = ${pid} returning slug`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("slug cannot be modified by admins", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        await beginUserSession(conn, userId, email);
        const slug = uniqueSlug();
        const pid2 = await conn.oneFirst(
          sql`select id from create_project(${slug}, ${slug})`
        );
        expect(
          conn.oneFirst(
            sql`update projects set slug = ${uniqueSlug()} where id = ${pid2} returning slug`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("is_featured cannot be modified by admins", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        await beginUserSession(conn, userId, email);
        const slug = uniqueSlug();
        const pid = await conn.oneFirst(
          sql`select id from create_project(${slug}, ${slug})`
        );
        expect(
          conn.oneFirst(
            sql`update projects set is_featured = true where id = ${pid}`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });
    test("is_featured can be modified by superusers", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        await beginUserSession(conn, userId, email);
        const slug = uniqueSlug();
        const pid = await conn.oneFirst(
          sql`select id from create_project(${slug}, ${slug})`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const isFeatured = await conn.oneFirst(
          sql`update projects set is_featured = true where id = ${pid} returning is_featured`
        );
        expect(isFeatured).toBe(true);
        await conn.any(sql`ROLLBACK;`);
      });
    });
  });

  describe("Project deletion", () => {
    test("Nobody can delete records", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        const pid = await insertProject(conn, userId, email);
        await conn.any(sql`SET ROLE seasketch_superuser`);
        await expect(
          conn.oneFirst(sql`delete from projects where id = ${pid}`)
        ).rejects.toThrow(/denied/);
        await conn.any(sql`ROLLBACK;`);
      });
    });
    test("Nobody sees projects marked is_deleted", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        const pid = await insertProject(conn, userId, email, {
          isDeleted: true,
          isListed: true,
        });
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const superuserCount = await conn.oneFirst(
          sql`select count(*) from projects where id = ${pid}`
        );
        expect(superuserCount).toBe(0);
        await conn.any(sql`SET ROLE seasketch_user`);
        const count = await conn.oneFirst(
          sql`select count(*) from projects where id = ${pid}`
        );
        expect(count).toBe(0);
        await conn.any(sql`SET ROLE anon`);
        const anonCount = await conn.oneFirst(
          sql`select count(*) from projects where id = ${pid}`
        );
        expect(anonCount).toBe(0);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("is_deleted and deleted_at cannot be updated directly", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId, email } = await insertUser(conn);
        const pid = await insertProject(conn, userId, email);
        await conn.any(sql`SET ROLE seasketch_superuser`);
        expect(
          conn.oneFirst(
            sql`update projects set is_deleted = true and deleted_at = now() where id = ${pid}`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Superusers can delete projects", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId } = await insertUser(conn);
        const pid = await createProject(conn, userId, "public");
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const { is_deleted, deleted_at } = await conn.one(
          sql`select is_deleted, deleted_at from delete_project(${pid})`
        );
        expect(is_deleted).toBe(true);
        expect(deleted_at).toBeLessThan(new Date().getTime() + 10000);
        expect(deleted_at).toBeGreaterThan(new Date().getTime() - 10000);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Project admins can delete their own projects", async () => {
      await pool.transaction(async (conn) => {
        const { id: userId } = await insertUser(conn);
        const pid = await createProject(conn, userId);
        await createSession(conn, userId);
        const isDeleted = await conn.oneFirst(
          sql`select is_deleted from delete_project(${pid})`
        );
        expect(isDeleted).toBe(true);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Admins cannot delete other admin's projects", async () => {
      await pool.transaction(async (conn) => {
        const userA = await insertUser(conn);
        const userB = await insertUser(conn);
        await createSession(conn, userA.id);
        const slugA = uniqueSlug();
        const pid = await conn.oneFirst(
          sql`select id from create_project(${slugA}, ${slugA})`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userB.id}, true)`
        );
        const slugB = uniqueSlug();
        await conn.oneFirst<number>(
          sql`select id from create_project(${slugB}, ${slugB})`
        );
        expect(
          conn.oneFirst(sql`select delete_project(${pid})`)
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });
  });

  describe("access-control settings", () => {
    describe("admins_only", () => {
      test("Is the default", async () => {
        await pool.transaction(async (conn) => {
          const userId = await createUser(conn);
          const pid = await createProject(conn, userId);
          const accessControl = await conn.oneFirst(
            sql`select access_control from projects where id = ${pid}`
          );
          expect(accessControl).toBe("admins_only");
          await conn.any(sql`ROLLBACK;`);
        });
      });
    });

    describe("invite_only", () => {
      test("Approved participants can see unlisted projects", async () => {
        await pool.transaction(async (conn) => {
          const user = await insertUser(conn);
          const unapproved = await insertUser(conn);
          const projectId = await insertProject(conn, user.id, user.email, {
            isListed: false,
            accessControl: "invite_only",
          });
          await conn.any(sql`SET ROLE seasketch_user`);
          await conn.any(
            sql`select set_config('session.user_id', ${user.id}, true)`
          );
          const count = await conn.oneFirst(
            sql`select count(*) from projects where id = ${projectId}`
          );
          expect(count).toBe(0);
          await conn.any(sql`SET ROLE postgres`);
          await conn.any(
            sql`insert into project_participants (user_id, project_id, approved) values (${user.id}, ${projectId}, true)`
          );
          await conn.any(
            sql`insert into project_participants (user_id, project_id, approved) values (${unapproved.id}, ${projectId}, false)`
          );
          await conn.any(sql`SET ROLE seasketch_user`);
          await conn.any(
            sql`select set_config('session.email_verified', 'true', true)`
          );
          const countAfter = await conn.oneFirst(
            sql`select count(*) from projects where id = ${projectId}`
          );
          expect(countAfter).toBe(1);
          await conn.any(
            sql`select set_config('session.user_id', ${unapproved.id}, true)`
          );
          const countUnapproved = await conn.oneFirst(
            sql`select count(*) from projects where id = ${projectId}`
          );
          expect(countUnapproved).toBe(0);
          await conn.any(sql`ROLLBACK;`);
        });
      });
    });

    describe("public", () => {
      test("Public projects cannot be unlisted", async () => {
        await pool.transaction(async (conn) => {
          const userId = await createUser(conn);
          const pid = await insertProject(conn, userId, "test-1@example.com");
          await expect(
            conn.oneFirst(
              sql`update projects set access_control = 'public', is_listed = false where id = ${pid}`
            )
          ).rejects.toThrow(/check/);
          await conn.any(sql`ROLLBACK;`);
        });
      });
    });
  });
});
