import { sql, createPool } from "slonik";

const pool = createPool("postgres://postgres:password@localhost:54320/test");

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
