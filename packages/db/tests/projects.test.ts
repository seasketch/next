import { sql, createPool } from "slonik";

const pool = createPool("postgres://postgres:password@localhost:54321/test");

describe("Access control", () => {
  describe("Listings", () => {
    test("Project admins can access unlisted projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        const pid = await conn.oneFirst(
          sql`INSERT INTO projects (name, slug, is_listed) values ('unlisted', 'unlisted', false) returning id`
        );
        await conn.any(
          sql`insert into project_participants (user_id, project_id, is_admin) values (${userId}, ${pid}, true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        const count = await conn.oneFirst(sql`select count(*) from projects`);
        expect(count).toBe(1);
        await conn.any(sql`ROLLBACK`);
      });
    });
    test("Superusers can see all projects, even unlisted", async () => {
      await pool.transaction(async (conn) => {
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_listed) values ('unlisted', 'unlisted', false)`
        );
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_listed) values ('listed', 'listed', true)`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const count = await conn.oneFirst(sql`select count(*) from projects`);
        expect(count).toBe(2);
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("Anonymous and unpriviledged users can only see listed projects", async () => {
      await pool.transaction(async (conn) => {
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_listed) values ('unlisted', 'unlisted', false)`
        );
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_listed) values ('listed', 'listed', true)`
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
        await conn.any(sql`ROLLBACK`);
      });
    });
  });

  describe("Project creation", () => {
    test("Nobody can directly insert records", async () => {
      await pool.transaction(async (conn) => {
        await conn.any(sql`SET ROLE seasketch_superuser`);
        await expect(
          conn.any(
            sql`INSERT INTO projects (name, slug) values ('nope', 'nope')`
          )
        ).rejects.toThrow(/denied/);
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("createProject mutation inserts project and admin records", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo', 'foo')`
        );
        expect(pid).toBeGreaterThan(0);
        await conn.any(sql`SET ROLE postgres`);
        const count = await conn.oneFirst(
          sql`select count(*) from project_participants where user_id = ${userId} and project_id = ${pid} and is_admin = true`
        );
        expect(count).toBe(1);
        await conn.any(sql`ROLLBACK`);
      });
    });
    test("createProject can only be called if email is verified", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        expect(
          conn.oneFirst(sql`select id from create_project('foo', 'foo')`)
        ).rejects.toThrow(/email/i);
        await conn.any(sql`ROLLBACK`);
      });
    });
    test("Anonymous users cannot create projects", async () => {
      await pool.transaction(async (conn) => {
        await conn.any(sql`SET ROLE seasketch_user`);
        expect(
          conn.oneFirst(sql`select id from create_project('foo', 'foo')`)
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });
  });

  describe("Project updates", () => {
    test("Superusers can update any project", async () => {
      await pool.transaction(async (conn) => {
        const pid = await conn.oneFirst(
          sql`INSERT INTO projects (name, slug) values ('foo', 'foo') returning id`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const isFeatured = await conn.oneFirst(
          sql`update projects set is_featured = true where id = ${pid} returning is_featured`
        );
        expect(isFeatured).toBe(true);
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("Admins can update their own projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo', 'foo')`
        );
        const isListed = await conn.oneFirst(
          sql`update projects set is_listed = true where id = ${pid} returning is_listed`
        );
        expect(isListed).toBe(true);
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("Admins cannot update projects they don't own", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        const userBId = await conn.oneFirst(
          sql`insert into users (sub) values ('Mr White') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo', 'foo')`
        );
        const isListed = await conn.oneFirst(
          sql`update projects set is_listed = true where id = ${pid} returning is_listed`
        );
        expect(isListed).toBe(true);
        await conn.any(
          sql`select set_config('session.user_id', ${userBId}, true)`
        );
        const pid2 = await conn.oneFirst(
          sql`select id from create_project('bar', 'bar')`
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
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("Anonymous users cannot update projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo', 'foo')`
        );
        await conn.any(sql`SET ROLE anon`);
        expect(
          conn.oneFirst(
            sql`update projects set is_listed = true where id = ${pid} returning is_listed`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("Unpriviledged users cannot update projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        const userBId = await conn.oneFirst(
          sql`insert into users (sub) values ('Mr White') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo', 'foo')`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userBId}, true)`
        );
        expect(
          conn.oneFirst(
            sql`update projects set is_listed = true where id = ${pid} returning is_listed`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("slug cannot be modified by superusers", async () => {
      await pool.transaction(async (conn) => {
        const pid = await conn.oneFirst(
          sql`INSERT INTO projects (name, slug) values ('foo', 'foo') returning id`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        expect(
          conn.oneFirst(
            sql`update projects set slug = 'new-slug' where id = ${pid} returning slug`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("slug cannot be modified by admins", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid2 = await conn.oneFirst(
          sql`select id from create_project('foo2', 'foo2')`
        );
        expect(
          conn.oneFirst(
            sql`update projects set slug = 'new-slug' where id = ${pid2} returning slug`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("is_featured cannot be modified by admins", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo', 'foo')`
        );
        expect(
          conn.oneFirst(
            sql`update projects set is_featured = true where id = ${pid}`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });
    test("is_featured can be modified by superusers", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo', 'foo')`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const isFeatured = await conn.oneFirst(
          sql`update projects set is_featured = true where id = ${pid} returning is_featured`
        );
        expect(isFeatured).toBe(true);
        await conn.any(sql`ROLLBACK`);
      });
    });
  });

  describe("Project deletion", () => {
    test("Nobody can delete records", async () => {
      await pool.transaction(async (conn) => {
        await conn.any(
          sql`INSERT INTO projects (name, slug) values ('name', 'name')`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        await expect(
          conn.oneFirst(sql`delete from projects where name = 'name'`)
        ).rejects.toThrow(/denied/);
        await conn.any(sql`ROLLBACK`);
      });
    });
    test("Nobody sees projects marked is_deleted", async () => {
      await pool.transaction(async (conn) => {
        await conn.any(
          sql`INSERT INTO projects (name, slug, is_deleted, deleted_at) values ('deleted', 'deleted', true, now())`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const superuserCount = await conn.oneFirst(
          sql`select count(*) from projects`
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
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("is_deleted and deleted_at cannot be updated directly", async () => {
      await pool.transaction(async (conn) => {
        const pid = await conn.oneFirst(
          sql`INSERT INTO projects (name, slug) values ('foo', 'foo') returning id`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        expect(
          conn.oneFirst(
            sql`update projects set is_deleted = true and deleted_at = now() where id = ${pid}`
          )
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("Superusers can delete projects", async () => {
      await pool.transaction(async (conn) => {
        const pid = await conn.oneFirst(
          sql`INSERT INTO projects (name, slug) values ('foo', 'foo') returning id`
        );
        await conn.any(sql`SET ROLE seasketch_superuser`);
        const { is_deleted, deleted_at } = await conn.one(
          sql`select is_deleted, deleted_at from delete_project(${pid})`
        );
        expect(is_deleted).toBe(true);
        expect(deleted_at).toBeLessThan(new Date().getTime() + 1000);
        expect(deleted_at).toBeGreaterThan(new Date().getTime() - 1000);
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("Project admins can delete their own projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo', 'foo')`
        );
        const isDeleted = await conn.oneFirst(
          sql`select is_deleted from delete_project(${pid})`
        );
        expect(isDeleted).toBe(true);
        await conn.any(sql`ROLLBACK`);
      });
    });

    test("Admins cannot delete other admin's projects", async () => {
      await pool.transaction(async (conn) => {
        const userId = await conn.oneFirst(
          sql`insert into users (sub) values ('Ahab') returning id`
        );
        const userBId = await conn.oneFirst(
          sql`insert into users (sub) values ('Mr White') returning id`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userId}, true)`
        );
        await conn.any(
          sql`select set_config('session.email_verified', 'true', true)`
        );
        await conn.any(sql`SET ROLE seasketch_user`);
        const pid = await conn.oneFirst(
          sql`select id from create_project('foo', 'foo')`
        );
        await conn.any(
          sql`select set_config('session.user_id', ${userBId}, true)`
        );
        const pid2 = await conn.oneFirst(
          sql`select id from create_project('bar', 'bar')`
        );
        expect(
          conn.oneFirst(sql`select delete_project(${pid})`)
        ).rejects.toThrow();
        await conn.any(sql`ROLLBACK`);
      });
    });
  });

  describe("access-control settings", () => {
    describe("admins_only", () => {
      test("Is the default", async () => {
        await pool.transaction(async (conn) => {
          const pid = await conn.oneFirst(
            sql`INSERT INTO projects (name, slug) values ('new', 'new') returning id`
          );
          const accessControl = await conn.oneFirst(
            sql`select access_control from projects where id = ${pid}`
          );
          expect(accessControl).toBe("admins_only");
          await conn.any(sql`ROLLBACK`);
        });
      });
      test.todo(
        "Only admins can access the project content (data, forums, surveys)"
      );
    });

    describe("invite_only", () => {
      test("Approved participants can see unlisted projects", async () => {
        await pool.transaction(async (conn) => {
          const userId = await conn.oneFirst(
            sql`insert into users (sub) values ('Ahab') returning id`
          );
          const unapprovedUserId = await conn.oneFirst(
            sql`insert into users (sub) values ('Mr White') returning id`
          );
          const projectId = await conn.oneFirst(
            sql`INSERT INTO projects (name, slug, is_listed, access_control) values ('unlisted', 'unlisted', false, 'invite_only') returning id`
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
          await conn.any(sql`ROLLBACK`);
        });
      });
      test.todo(
        "Only approved participants can access the project content (data, forums, surveys)"
      );
    });

    describe("public", () => {
      test.todo("Anyone can access content");
      test("Public projects cannot be unlisted", async () => {
        await pool.transaction(async (conn) => {
          const pid = await conn.oneFirst(
            sql`INSERT INTO projects (name, slug) values ('name', 'name') returning id`
          );
          await expect(
            conn.oneFirst(
              sql`update projects set access_control = 'public', is_listed = false where id = ${pid}`
            )
          ).rejects.toThrow(/check/);
          await conn.any(sql`ROLLBACK`);
        });
      });
    });
  });

  describe("content-specific access control", () => {
    test.todo("Group list is only available to admins");
    test.todo("Participants list is only available to admins");
    test.todo("Related users are only available to admins");
  });
});
