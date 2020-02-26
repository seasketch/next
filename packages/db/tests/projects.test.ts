import { sql, createPool } from "slonik";

const pool = createPool("postgres://postgres:password@localhost:54320/test");
const roles = [
  "seasketch_admin",
  "anon",
  "seasketch_user",
  "seasketch_superuser"
];

test("Anonymous and unpriviledged users can only see published projects", async () => {
  await pool.transaction(async conn => {
    await conn.any(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('test1', 'test1', false)`
    );
    await conn.any(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('test1published', 'test1published', true)`
    );
    await conn.any(sql`SET ROLE anon`);
    const id = await conn.maybeOneFirst(
      sql`SELECT id from projects where name = 'test1'`
    );
    expect(id).toBeNull();
    const publicId = await conn.maybeOneFirst(
      sql`SELECT id from projects where name = 'test1published'`
    );
    expect(publicId).not.toBeNull();
    await conn.any(sql`SET ROLE seasketch_user`);
    const name = await conn.oneFirst(sql`select name from projects`);
    expect(name).toBe("test1published");
    await conn.any(sql`ROLLBACK`);
  });
});

test("Project admins can access unpublished projects they administer (but not those they don't own)", async () => {
  await pool.transaction(async conn => {
    const unpublished = await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('unpublished-1', 'unpublished1', false) returning *`
    );
    const unpublished2 = await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('unpublished-2', 'unpublished2', false) returning *`
    );
    const published = await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('published-1', 'published1', true) returning *`
    );
    expect(published.id).toBeGreaterThan(0);
    await conn.any(sql`SET ROLE seasketch_admin`);
    await conn.any(
      sql`select set_config('session.project_id', ${unpublished.id}, false)`
    );
    const projects = await conn.many(sql`select id, name from projects`);
    expect(projects.length).toBe(2);
    const unp = projects.find(p => p.id === unpublished.id);
    expect(unp).not.toBeNull();
    const pub = projects.find(p => p.id === published.id);
    expect(pub).not.toBeNull();
    await conn.any(sql`ROLLBACK`);
  });
});

test("Superusers can access all projects", async () => {
  await pool.transaction(async conn => {
    await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('unpublished-3', 'unpublished3', false) returning *`
    );
    await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('unpublished-4', 'unpublished4', false) returning *`
    );
    await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('published-5', 'published5', true) returning *`
    );
    await conn.any(sql`SET ROLE seasketch_superuser`);
    const projects = await conn.many(sql`select id, name from projects`);
    expect(projects.length).toBe(3);
    await conn.any(sql`ROLLBACK`);
  });
});

test("Anonymous users cannot modify projects", async () => {
  await pool.transaction(async conn => {
    const project = await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('published', 'published', true) returning *`
    );
    await conn.any(sql`SET ROLE anon`);
    try {
      await conn.one(
        sql`UPDATE projects set description = 'testing' where id = ${project.id} returning *`
      );
    } catch (e) {
      expect(e.message).toMatch("permission denied");
    }
    await conn.any(sql`ROLLBACK`);
  });
});

test("Unpriviledged users cannot modify projects", async () => {
  await pool.transaction(async conn => {
    const project = await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('published', 'published', true) returning *`
    );
    await conn.any(sql`SET ROLE seasketch_user`);
    try {
      await conn.one(
        sql`UPDATE projects set description = 'testing' where id = ${project.id} returning *`
      );
    } catch (e) {
      expect(e.message).toMatch("permission denied");
    }
    await conn.any(sql`ROLLBACK`);
  });
});

test("Project admins can update projects", async () => {
  expect.assertions(1);
  await pool.transaction(async conn => {
    const project = await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('published', 'published', true) returning *`
    );
    await conn.any(sql`SET ROLE seasketch_admin`);
    await conn.any(
      sql`select set_config('session.project_id', ${project.id}, false)`
    );
    try {
      const updated = await conn.one(
        sql`UPDATE projects set description = 'testing' where id = ${project.id} returning *`
      );
      expect(updated.description).toBe("testing");
    } catch (e) {
      expect(e.message).toMatch("permission denied");
    }
    await conn.any(sql`ROLLBACK`);
  });
});

test("Superusers can update projects", async () => {
  expect.assertions(1);
  await pool.transaction(async conn => {
    const project = await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('published', 'published', true) returning *`
    );
    await conn.any(sql`SET ROLE seasketch_superuser`);
    try {
      const updated = await conn.one(
        sql`UPDATE projects set description = 'testing' where id = ${project.id} returning *`
      );
      expect(updated.description).toBe("testing");
    } catch (e) {
      expect(e.message).toMatch("permission denied");
    }
    await conn.any(sql`ROLLBACK`);
  });
});

test("id, subdomain and legacy_id cannot be modified by anyone", async () => {
  expect.assertions(12);
  const props = ["id", "subdomain", "legacy_id"];
  for (const role of roles) {
    for (const prop of props) {
      await pool.transaction(async conn => {
        const project = await conn.one(
          sql`INSERT INTO projects (name, subdomain, is_published) values ('published', 'published', true) returning *`
        );
        switch (role) {
          case "anon":
            await conn.any(sql`SET ROLE anon`);
            break;
          case "seasketch_superuser":
            await conn.any(sql`SET ROLE seasketch_superuser`);
            break;
          case "seasketch_user":
            await conn.any(sql`SET ROLE seasketch_user`);
            break;
          case "seasketch_admin":
            await conn.any(sql`SET ROLE seasketch_admin`);
            break;
          default:
            break;
        }
        await conn.any(
          sql`select set_config('session.project_id', ${project.id}, false)`
        );
        try {
          const updated = await conn.one(
            sql`UPDATE projects set ${sql.identifier([prop])} = ${
              prop === "id" ? 1000 : "hackery"
            } where id = ${project.id} returning *`
          );
        } catch (e) {
          expect(e.message).toMatch("permission denied");
        }
        await conn.any(sql`ROLLBACK`);
      });
    }
  }
});

test("is_featured can only be modified by superusers", async () => {
  expect.assertions(4);
  for (const role of roles.filter(r => r !== "seasketch_superuser")) {
    await pool.transaction(async conn => {
      const project = await conn.one(
        sql`INSERT INTO projects (name, subdomain, is_published) values ('published', 'published', true) returning *`
      );
      switch (role) {
        case "anon":
          await conn.any(sql`SET ROLE anon`);
          break;
        case "seasketch_user":
          await conn.any(sql`SET ROLE seasketch_user`);
          break;
        case "seasketch_admin":
          await conn.any(sql`SET ROLE seasketch_admin`);
          break;
        default:
          break;
      }
      await conn.any(
        sql`select set_config('session.project_id', ${project.id}, false)`
      );
      try {
        await conn.one(
          sql`UPDATE projects set is_featured = true where id = ${project.id} returning *`
        );
      } catch (e) {
        expect(e.message).toMatch("permission denied");
      }
      await conn.any(sql`ROLLBACK`);
    });
  }
  await pool.transaction(async conn => {
    const project = await conn.one(
      sql`INSERT INTO projects (name, subdomain, is_published) values ('published', 'published', true) returning *`
    );
    await conn.any(sql`SET ROLE seasketch_superuser`);
    await conn.any(
      sql`select set_config('session.project_id', ${project.id}, false)`
    );
    const updated = await conn.one(
      sql`UPDATE projects set is_featured = true where id = ${project.id} returning *`
    );
    expect(updated.is_featured).toBe(true);
    await conn.any(sql`ROLLBACK`);
  });
});

test("Nobody can entirely delete projects from the db", async () => {
  expect.assertions(4);
  for (const role of roles) {
    await pool.transaction(async conn => {
      const project = await conn.one(
        sql`INSERT INTO projects (name, subdomain, is_published) values ('published', 'published', true) returning *`
      );
      switch (role) {
        case "anon":
          await conn.any(sql`SET ROLE anon`);
          break;
        case "seasketch_user":
          await conn.any(sql`SET ROLE seasketch_user`);
          break;
        case "seasketch_admin":
          await conn.any(sql`SET ROLE seasketch_admin`);
          break;
        case "seasketch_superuser":
          await conn.any(sql`SET ROLE seasketch_superuser`);
          break;
        default:
          break;
      }
      await conn.any(
        sql`select set_config('session.project_id', ${project.id}, false)`
      );
      try {
        await conn.one(
          sql`DELETE FROM projects where id = ${project.id} returning *`
        );
      } catch (e) {
        expect(e.message).toMatch("permission denied");
      }
      await conn.any(sql`ROLLBACK`);
    });
  }
});

test('"Deleted" projects are not visible to any users', async () => {
  expect.assertions(4);
  for (const role of roles) {
    await pool.transaction(async conn => {
      const project = await conn.one(
        sql`INSERT INTO projects (name, subdomain, is_published, is_deleted) values ('published', 'published', true, true) returning *`
      );
      switch (role) {
        case "anon":
          await conn.any(sql`SET ROLE anon`);
          break;
        case "seasketch_user":
          await conn.any(sql`SET ROLE seasketch_user`);
          break;
        case "seasketch_admin":
          await conn.any(sql`SET ROLE seasketch_admin`);
          break;
        case "seasketch_superuser":
          await conn.any(sql`SET ROLE seasketch_superuser`);
          break;
        default:
          break;
      }
      await conn.any(
        sql`select set_config('session.project_id', ${project.id}, false)`
      );
      try {
        const p = await conn.one(
          sql`SELECT * FROM projects WHERE id = ${project.id}`
        );
        console.log(p.name);
      } catch (e) {
        expect(e.message).toMatch("not found");
      }
      await conn.any(sql`ROLLBACK`);
    });
  }
});
