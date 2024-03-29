import { sql } from "slonik";
import { createProject, createSession, createUser } from "./helpers";
import { createPool } from "./pool";

const pool = createPool("test");

describe("Access control", () => {
  describe("Listings", () => {
    test("Project admins can access unlisted projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst<number>(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await createSession(conn, userId, true, false);
        const pid = await createProject(conn, userId);
        await conn.any(
          sql`update projects set is_listed = false where id = ${pid}`
        );
        const count = await conn.oneFirst<number>(
          sql`select count(*) from projects where slug != 'superuser'`
        );
        expect(count).toBe(1);
        await conn.any(sql`ROLLBACK;`);
      });
    });
    test("Superusers can see all projects, even unlisted", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst<number>(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_listed, creator_id, support_email) values ('unlisted', 'unlisted', false, ${userId}, 'ahab@example.com')`
        );
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_listed, creator_id, support_email) values ('listed', 'listed', true, ${userId}, 'ahab@example.com')`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const count = await conn.oneFirst(
          sql`select count(*) from projects where slug != 'superuser'`
        );
        expect(count).toBe(2);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Anonymous and unpriviledged users can only see listed projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst<number>(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_listed, creator_id, support_email) values ('unlisted', 'unlisted', false, ${userId}, 'ahab@example.com')`
        );
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_listed, creator_id, support_email) values ('listed', 'listed', true, ${userId}, 'ahab@example.com')`
        );
        await conn.any(sql`SET ROLE anon`);
        const id = await conn.maybeOneFirst(
          sql`SELECT id from projects where name = 'unlisted'`
        );
        expect(id).toBeNull();
        const listedId = await conn.maybeOneFirst(
          sql`SELECT id from projects where name = 'listed'`
        );
        expect(listedId).not.toBeNull();
        await conn.any(sql`SET ROLE seasketch_user`);
        const name = await conn.oneFirst(sql`select name from projects`);
        expect(name).toBe("listed");
        const count = await conn.oneFirst(sql`select count(*) from projects`);
        expect(count).toBe(1);
        await conn.any(sql`ROLLBACK;`);
      });
    });
  });

  describe("Project creation", () => {
    test("Nobody can directly insert records", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst<number>(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        await expect(
          conn.any(
            sql`INSERT INTO projects (name, slug, creator_id, support_email) values ('nope', 'nope', ${userId}, 'ahab@example.com')`
          )
        ).rejects.toThrow(/denied/);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("createProject mutation inserts project and admin records", async () => {
      await pool.transaction(async (conn) => {
        await conn.query(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(
          sql`select set_config('session.canonical_email', 'ahab@example.com', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo1', 'foo1')`
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
        await conn.query(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
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
        await conn.query(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.canonical_email', 'ahab@example.com', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        expect(
          conn.oneFirst(sql`select id from create_project('foo2', 'foo2')`)
        ).rejects.toThrow(/email/i);
        await conn.any(sql`ROLLBACK;`);
      });
    });
    test("Anonymous users cannot create projects", async () => {
      await pool.transaction(async (conn) => {
        await conn.any(sql`SET ROLE seasketch_user`);
        expect(
          conn.oneFirst(sql`select id from create_project('foo3', 'foo3')`)
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });
  });

  describe("Project updates", () => {
    test("Superusers can update any project", async () => {
      await pool.transaction(async (conn) => {
        await conn.query(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        const pid = await conn.oneFirst(
          sql`INSERT INTO projects (name, slug, creator_id, support_email) values ('foo4', 'foo4', ${userId}, 'ahab@example.com') returning id`
        );
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
        await conn.query(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(
          sql`select set_config('session.canonical_email', 'ahab@example.com', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo5', 'foo5')`
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
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        const userBId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Mr White', 'twwk@example.com') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(
          sql`select set_config('session.canonical_email', 'ahab@example.com', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo6', 'foo6')`
        );
        const isListed = await conn.oneFirst(
          sql`update projects set is_listed = true where id = ${pid} returning is_listed`
        );
        expect(isListed).toBe(true);
        await conn.any(
          sql`select set_config('session.canonical_email', 'twwk@example.com', true)`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userBId}, true)`
        );
        const pid2 = await conn.oneFirst(
          sql`select id from create_project('bar1', 'bar1')`
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
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(
          sql`select set_config('session.canonical_email', 'ahab@example.com', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo7', 'foo7')`
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
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        const userBId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Mr White', 'iatwwk@example.com') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.canonical_email', 'ahab@example.com', true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo8', 'foo8')`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userBId}, true)`
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
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        const pid = await conn.oneFirst(
          sql`INSERT INTO projects (name, slug, creator_id, support_email) values ('foo9', 'foo9', ${userId}, 'ahab@example.com') returning id`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        expect(
          conn.oneFirst(
            sql`update projects set slug = 'new-slug' where id = ${pid} returning slug`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("slug cannot be modified by admins", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(
          sql`select set_config('session.canonical_email', 'ahab@example.com', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid2 = await conn.oneFirst(
          sql`select id from create_project('foo10', 'foo10')`
        );
        expect(
          conn.oneFirst(
            sql`update projects set slug = 'new-slug' where id = ${pid2} returning slug`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("is_featured cannot be modified by admins", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(
          sql`select set_config('session.canonical_email', 'ahab@example.com', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo11', 'foo11')`
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
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(
          sql`select set_config('session.canonical_email', 'ahab@example.com', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo12', 'foo12')`
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
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`INSERT INTO projects (name, slug, creator_id, support_email) values ('name', 'name', ${userId}, 'ahab@example.com')`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        await expect(
          conn.oneFirst(sql`delete from projects where name = 'name'`)
        ).rejects.toThrow(/denied/);
        await conn.any(sql`ROLLBACK;`);
      });
    });
    test("Nobody sees projects marked is_deleted", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_deleted, deleted_at, creator_id, support_email) values ('deleted', 'deleted', true, now(), ${userId}, 'ahab@example.com')`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const superuserCount = await conn.oneFirst(
          sql`select count(*) from projects where slug != 'superuser'`
        );
        expect(superuserCount).toBe(0);
        await conn.any(sql`SET ROLE seasketch_user`);
        const count = await conn.oneFirst(sql`select count(*) from projects`);
        expect(count).toBe(0);
        await conn.any(sql`SET ROLE anon`);
        const anonCount = await conn.oneFirst(
          sql`select count(*) from projects`
        );
        expect(anonCount).toBe(0);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("is_deleted and deleted_at cannot be updated directly", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        const pid = await conn.oneFirst(
          sql`INSERT INTO projects (name, slug, creator_id, support_email) values ('foo13', 'foo13', ${userId}, 'ahab@example.com') returning id`
        );
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
        const userId = await conn.oneFirst<number>(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        const pid = await createProject(conn, userId, "public");
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const { is_deleted, deleted_at } = await conn.one(
          sql`select is_deleted, deleted_at from delete_project(${pid})`
        );
        expect(is_deleted).toBe(true);
        expect(deleted_at).toBeLessThan(new Date().getTime() + 1000);
        expect(deleted_at).toBeGreaterThan(new Date().getTime() - 1000);
        await conn.any(sql`ROLLBACK;`);
      });
    });

    test("Project admins can delete their own projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst<number>(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
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
        const userId = await conn.oneFirst<number>(
          sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
        );
        const userBId = await conn.oneFirst<number>(
          sql`insert into users (sub, canonical_email) values ('Mr White', 'white@example.com') returning id`
        );
        await createSession(conn, userId);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo16', 'foo16')`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userBId}, true)`
        );
        const pid2 = await conn.oneFirst<number>(
          sql`select id from create_project('bar2', 'bar2')`
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
          const userId = await conn.oneFirst(
            sql`insert into users (sub, canonical_email) values ('Ahab', 'ahab@example.com') returning id`
          );
          const unapprovedUserId = await conn.oneFirst(
            sql`insert into users (sub, canonical_email) values ('Mr White', 'twwk@example.com') returning id`
          );
          const projectId = await conn.oneFirst(
            sql`INSERT INTO projects (name, slug, is_listed, access_control, creator_id, support_email) values ('unlisted', 'unlisted', false, 'invite_only', ${userId}, 'ahab@exampl.com') returning id`
          );
          await conn.any(sql`SET ROLE seasketch_user`);
          await conn.any(
            sql`select set_config('session.user_id', ${userId}, true)`
          );
          const count = await conn.oneFirst(sql`select count(*) from projects`);
          expect(count).toBe(0);
          await conn.any(sql`SET ROLE postgres`);
          await conn.any(
            sql`insert into project_participants (user_id, project_id, approved) values (${userId}, ${projectId}, true)`
          );
          await conn.any(
            sql`insert into project_participants (user_id, project_id, approved) values (${unapprovedUserId}, ${projectId}, false)`
          );
          await conn.any(sql`SET ROLE seasketch_user`);
          await conn.any(
            sql`select set_config('session.email_verified', 'true', true)`
          );
          const countAfter = await conn.oneFirst(
            sql`select count(*) from projects`
          );
          expect(countAfter).toBe(1);
          await conn.any(
            sql`select set_config('session.user_id', ${unapprovedUserId}, true)`
          );
          const countUnapproved = await conn.oneFirst(
            sql`select count(*) from projects`
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
          const pid = await conn.oneFirst(
            sql`INSERT INTO projects (name, slug, creator_id, support_email) values ('name', 'name', ${userId}, 'test-1@example.com') returning id`
          );
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
