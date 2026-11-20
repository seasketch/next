import { sql } from "slonik";
import { createPool } from "./pool";
import { createSession, projectTransaction } from "./helpers";

const pool = createPool("test");

const reefMessage = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "The reef is healthy." }],
    },
  ],
};

const secretMessage = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hidden moderator note." }],
    },
  ],
};

async function asAnon(conn: any) {
  await conn.any(sql`set role anon`);
}

async function preview(
  conn: any,
  slug: string,
  kind: string,
  forumId: number | null = null,
  topicId: number | null = null,
  postId: number | null = null
) {
  await asAnon(conn);
  return conn.oneFirst(sql`
    select page_link_preview(
      ${slug},
      ${kind},
      ${forumId},
      ${topicId},
      ${postId}
    )`);
}

describe("page link previews", () => {
  test("public project pages use the name, description, and https logo", async () => {
    await projectTransaction(pool, "public", async (conn, projectId) => {
      const slug = (await conn.oneFirst(
        sql`select slug from projects where id = ${projectId}`
      )) as string;
      await conn.any(sql`set role postgres`);
      await conn.any(sql`
        update projects
        set name = ${"American Samoa"},
            description = ${"Maps\n\nfor the territory."},
            logo_url = ${"https://cdn.example/logo.png"}
        where id = ${projectId}`);

      const project = await preview(conn, slug, "project");
      expect(project).toMatchObject({
        title: "American Samoa",
        description: "Maps for the territory.",
        imageUrl: "https://cdn.example/logo.png",
      });

      const forums = await preview(conn, slug, "forums");
      expect(forums).toMatchObject({
        title: "American Samoa",
        description: "Discussion forums for American Samoa.",
        imageUrl: "https://cdn.example/logo.png",
      });

      await conn.any(sql`set role postgres`);
      await conn.any(sql`
        update projects
        set description = null,
            logo_url = ${"javascript:alert(1)"}
        where id = ${projectId}`);
      const fallback = await preview(conn, slug, "project");
      expect(fallback).toMatchObject({
        title: "American Samoa",
        description: "A SeaSketch project.",
      });
      expect(fallback.imageUrl).toBeUndefined();

      await conn.any(sql`set role postgres`);
      await conn.any(sql`
        update projects
        set description = ${"x".repeat(300)}
        where id = ${projectId}`);
      const truncated = await preview(conn, slug, "project");
      expect(truncated.description).toHaveLength(240);
      expect(truncated.description.endsWith("…")).toBe(true);
    });
  });

  test("private and deleted projects return nothing", async () => {
    await projectTransaction(pool, "admins_only", async (conn, projectId) => {
      const slug = (await conn.oneFirst(
        sql`select slug from projects where id = ${projectId}`
      )) as string;
      await conn.any(sql`set role postgres`);
      await conn.any(sql`
        update projects set name = ${"Secret Project"} where id = ${projectId}`);
      expect(await preview(conn, slug, "project")).toBeNull();
      expect(await preview(conn, slug, "forums")).toBeNull();
    });

    await projectTransaction(pool, "invite_only", async (conn, projectId) => {
      const slug = (await conn.oneFirst(
        sql`select slug from projects where id = ${projectId}`
      )) as string;
      await conn.any(sql`set role postgres`);
      await conn.any(sql`
        update projects set name = ${"Invite Only"} where id = ${projectId}`);
      expect(await preview(conn, slug, "project")).toBeNull();
    });

    await projectTransaction(pool, "public", async (conn, projectId) => {
      const slug = (await conn.oneFirst(
        sql`select slug from projects where id = ${projectId}`
      )) as string;
      await conn.any(sql`set role postgres`);
      await conn.any(sql`
        update projects
        set name = ${"Gone Project"}, is_deleted = true
        where id = ${projectId}`);
      expect(await preview(conn, slug, "project")).toBeNull();
      expect(await preview(conn, "missing-slug", "project")).toBeNull();
    });
  });

  test("forum, topic, and message previews stay inside a public forum", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId) => {
        const slug = (await conn.oneFirst(
          sql`select slug from projects where id = ${projectId}`
        )) as string;
        await conn.any(sql`set role postgres`);
        await conn.any(sql`
          update projects
          set name = ${"American Samoa"},
              description = ${"Coastal maps."}
          where id = ${projectId}`);
        const forumId = Number(
          await conn.oneFirst(sql`
            insert into forums (project_id, name, description)
            values (${projectId}, 'Planning', 'Where the plan is discussed.')
            returning id`)
        );
        const privateForumId = Number(
          await conn.oneFirst(sql`
            insert into forums (project_id, name, description)
            values (${projectId}, 'Steering committee', 'Private notes.')
            returning id`)
        );
        await conn.any(sql`
          update access_control_lists
          set type = 'admins_only'
          where forum_id_read = ${privateForumId}`);

        await createSession(conn, adminId, true, false, projectId);
        const topicId = Number(
          await conn.oneFirst(sql`
            select id from create_topic(
              ${forumId},
              'Reef survey',
              ${sql.json(reefMessage)},
              '<p>The reef is healthy.</p>'
            )`)
        );
        const postId = Number(
          await conn.oneFirst(sql`
            select id from posts where topic_id = ${topicId} order by id limit 1`)
        );
        const secretId = Number(
          await conn.oneFirst(sql`
            select id from create_post(
              ${sql.json(secretMessage)},
              ${topicId},
              '<p>Hidden moderator note.</p>'
            )`)
        );
        const otherTopicId = Number(
          await conn.oneFirst(sql`
            select id from create_topic(
              ${forumId},
              'Other thread',
              ${sql.json(secretMessage)},
              '<p>Hidden moderator note.</p>'
            )`)
        );
        await conn.any(sql`set role postgres`);
        await conn.any(sql`
          update posts set hidden_by_moderator = true where id = ${secretId}`);

        expect(await preview(conn, slug, "forum", forumId)).toMatchObject({
          title: "Planning",
          description: "Where the plan is discussed.",
        });
        expect(await preview(conn, slug, "topic", forumId, topicId)).toMatchObject({
          title: "Reef survey",
          description: "In Planning on American Samoa.",
        });
        expect(
          await preview(conn, slug, "post", forumId, topicId, postId)
        ).toMatchObject({
          title: "Reef survey",
          description: "The reef is healthy.",
        });

        const hidden = await preview(conn, slug, "post", forumId, topicId, secretId);
        expect(hidden).toMatchObject({
          title: "Reef survey",
          description: "In Planning on American Samoa.",
        });
        expect(JSON.stringify(hidden)).not.toContain("Hidden moderator note");

        const crossed = await preview(
          conn,
          slug,
          "post",
          forumId,
          topicId,
          Number(
            await conn.oneFirst(sql`
              select id from posts where topic_id = ${otherTopicId} order by id limit 1`)
          )
        );
        expect(JSON.stringify(crossed)).not.toContain("Hidden moderator note");
        expect(crossed.description).toBe("In Planning on American Samoa.");

        expect(await preview(conn, slug, "forum", privateForumId)).toBeNull();
        expect(
          await preview(conn, slug, "topic", privateForumId, topicId)
        ).toBeNull();
        expect(await preview(conn, "other-project", "forum", forumId)).toBeNull();
        expect(await preview(conn, slug, "nope")).toBeNull();

        await conn.any(sql`set role postgres`);
        await conn.any(sql`
          update forums set description = null where id = ${forumId}`);
        expect((await preview(conn, slug, "forum", forumId)).description).toBe(
          "A forum in American Samoa."
        );

        await conn.any(sql`set role postgres`);
        await conn.any(sql`
          update forums set archived = true where id = ${forumId}`);
        expect(await preview(conn, slug, "forum", forumId)).toBeNull();
        expect(await preview(conn, slug, "post", forumId, topicId, postId)).toBeNull();

        await conn.any(sql`set role postgres`);
        await conn.any(sql`
          update projects set hide_forums = true where id = ${projectId}`);
        expect(await preview(conn, slug, "forums")).toBeNull();
        expect((await preview(conn, slug, "project")).title).toBe("American Samoa");
      }
    );
  });
});
