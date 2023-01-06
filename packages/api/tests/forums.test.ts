import {
  projectTransaction,
  createSession,
  createGroup,
  addUserToGroup,
  clearSession,
  verifyCRUDOpsLimitedToAdmins,
} from "./helpers";
import { createPool } from "./pool";
import { sql } from "slonik";

const pool = createPool("test");

describe("Forum access control", () => {
  test("public forums in public projects can be accessed by any user", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        const forum = await conn.one(
          sql`select * from forums where project_id = ${projectId}`
        );
        expect(forum.name).toBe("Forum A");
      }
    );
  });
  test("public forums in an invite only project are hidden from anonymous users", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn);
        const forums = await conn.any(
          sql`select * from forums where project_id = ${projectId}`
        );
        expect(forums.length).toBe(0);
      }
    );
  });

  test("forums limited to group access are only accessible by users in that group", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        const groupA = await createGroup(conn, projectId);
        const aclId = await conn.oneFirst(
          sql`update access_control_lists set type = 'group' where forum_id_read = ${forumId} returning id`
        );
        await conn.any(
          sql`insert into access_control_list_groups (group_id, access_control_list_id) values (${groupA}, ${aclId})`
        );
        await createSession(conn, userA, true, false, projectId);
        let forums = await conn.any(
          sql`select * from forums where project_id = ${projectId}`
        );
        expect(forums.length).toBe(0);
        await createSession(conn, adminId, true, false, projectId);
        await addUserToGroup(conn, userA, groupA);
        await createSession(conn, userA, true, false, projectId);
        forums = await conn.any(
          sql`select * from forums where project_id = ${projectId}`
        );
        expect(forums.length).toBe(1);
      }
    );
  });

  test("only admins can create, update, and delete forums", async () => {
    await verifyCRUDOpsLimitedToAdmins(pool, {
      create: async (conn, projectId, adminId) => {
        return sql`insert into forums (project_id, name) values (${projectId}, 'forum a') returning id`;
      },
      update: (id) => {
        return sql`update forums set name = 'foo' where id = ${id} returning *`;
      },
      delete: (id) => {
        return sql`delete from forums where id = ${id}`;
      },
    });
  });
});

describe("Forum fields", () => {
  test("order of forums is set by setForumSortOrder", async () => {
    await projectTransaction(
      pool,
      "public",
      async (conn, projectId, adminId, [userA]) => {
        const forumA = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        const forumB = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum B') returning id`
        );
        const forumC = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum C') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read is not null`
        );
        await createSession(conn, adminId, true, false, projectId);
        await conn.any(
          sql`select set_forum_order(${sql.array([forumA, forumC], "int4")})`
        );
        const forums = await conn.many(
          sql`select id,position from forums order by position asc`
        );
        expect(forums.map((f) => f.id).join(",")).toBe(
          [forumA, forumC, forumB].join(",")
        );
      }
    );
  });
});

describe("Topic access control", () => {
  test("reading topics in a forum can be limited to an access control list", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        const topics = await conn.any(
          sql`select * from topics where forum_id = ${forumId}`
        );
        expect(topics.length).toBe(1);
        expect(topics[0].title).toBe("Topic A");
      }
    );
  });
  describe("archived forums", () => {
    test("new topics cannot be posted to archived forums", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name, archived) values (${projectId}, 'Forum A', true) returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          await createSession(conn, userA, true, false, projectId);

          expect(
            conn.any(
              sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
            )
          ).rejects.toThrow(/archived/i);
        }
      );
    });
    test("new messages cannot be posted to topics in archived forums", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name, archived) values (${projectId}, 'Forum A', false) returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          const parts = await conn.any(
            sql`update project_participants set share_profile = true returning *`
          );
          await createSession(conn, userA, true, false, projectId);
          const topicId = await conn.oneFirst(
            sql`select id from create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
          );
          const reply1Id = await conn.oneFirst(
            sql`select id from create_post('{}'::jsonb, ${topicId}, '<div />')`
          );
          expect(reply1Id).toBeGreaterThan(0);
          await createSession(conn, adminId, true, false, projectId);
          await conn.any(sql`update forums set archived = true`);
          await createSession(conn, userA, true, false, projectId);
          expect(
            conn.any(
              sql`select create_post('{"message": "foo"}'::jsonb, ${topicId}, '<div />')`
            )
          ).rejects.toThrow(/archived/i);
        }
      );
    });
  });
  describe("Topic posting", () => {
    test("topics are posted with an initial post", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          await createSession(conn, userA, true, false, projectId);
          await conn.any(
            sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
          );
          const posts = await conn.any(sql`select * from posts`);
          expect(posts.length).toBe(1);
        }
      );
    });
    test("topics cannot be posted directly without a custom function", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          await createSession(conn, userA, true, false, projectId);
          expect(
            conn.any(
              sql`insert into topics (forum_id, title, author_id) values (${forumId}, 'foo', ${userA})`
            )
          ).rejects.toThrow(/denied/i);
        }
      );
    });
    test("posting to a forum can be limited to an access control list", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'admins_only' where forum_id_write = ${forumId}`
          );
          await createSession(conn, userA, true, false, projectId);
          expect(
            conn.any(
              sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
            )
          ).rejects.toThrow(/denied/);
        }
      );
    });
    test("topics can only be deleted by their original author for 5 minutes", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          await createSession(conn, userA, true, false, projectId);
          await conn.any(
            sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
          );
          await conn.any(sql`delete from topics where title = 'Topic A'`);
          let posts = await conn.any(sql`select * from posts`);
          expect(posts.length).toBe(0);
          await conn.any(
            sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
          );
          await clearSession(conn);
          await conn.any(
            sql`update topics set created_at = now() - interval '1 month'`
          );
          await createSession(conn, userA, true, false, projectId);
          await conn.any(
            sql`delete from topics where title = 'Topic A' returning id`
          );
          posts = await conn.any(sql`select * from posts`);
          expect(posts.length).toBe(1);
        }
      );
    });
  });
  test("topic titles cannot be changed after 5 minutes", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        await conn.any(sql`update topics set title = 'Topic A (edited)'`);
        let topics = await conn.any(sql`select * from topics`);
        expect(topics.length).toBe(1);
        expect(topics[0].title).toBe("Topic A (edited)");
        await clearSession(conn);
        await conn.any(
          sql`update topics set created_at = now() - interval '1 month'`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(sql`update topics set title = 'Topic A (edited again)'`);
        topics = await conn.any(sql`select * from topics`);
        expect(topics[0].title).toBe("Topic A (edited)");
      }
    );
  });
  test("posts can only be edited for 5 minutes", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        const postId = await conn.oneFirst(sql`select id from posts`);
        await conn.any(
          sql`select update_post(${postId}, '{"message": "updated"}'::jsonb)`
        );
        let post = await conn.one(sql`select * from posts`);
        // @ts-ignore
        expect(post.message_contents.message).toBe("updated");
        await clearSession(conn);
        await conn.any(
          sql`update posts set created_at = now() - interval '5.5 minutes'`
        );
        await createSession(conn, userA, true, false, projectId);
        expect(
          conn.any(
            sql`select update_post(${postId}, '{"message": "updated again"}'::jsonb)`
          )
        ).rejects.toThrow(/5 minutes/i);
      }
    );
  });
});

describe("Moderation", () => {
  test("admins can delete objectionable topics regardless of age", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        await clearSession(conn);
        await conn.any(
          sql`update topics set created_at = now() - interval '1 month'`
        );
        await createSession(conn, adminId, true, false, projectId);
        await conn.any(sql`delete from topics where title = 'Topic A'`);
        const posts = await conn.any(sql`select * from posts`);
        expect(posts.length).toBe(0);
      }
    );
  });
  test("admins can change topic titles", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        await clearSession(conn);
        await conn.any(
          sql`update topics set created_at = now() - interval '1 month'`
        );
        await createSession(conn, adminId, true, false, projectId);
        const newTitle = await conn.oneFirst(
          sql`update topics set title = 'Edited' returning title`
        );
        expect(newTitle).toBe("Edited");
      }
    );
  });
  test("admins can hide posts that violate community guidelines, which will hide the message contents from project users", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        await clearSession(conn);
        await conn.any(
          sql`update topics set created_at = now() - interval '1 month'`
        );
        const postId = await conn.oneFirst(sql`select id from posts`);
        await createSession(conn, adminId, true, false, projectId);
        await conn.oneFirst(
          sql`select set_post_hidden_by_moderator(${postId}, true)`
        );
        await createSession(conn, userA, true, false, projectId);
        const post = await conn.one(sql`select * from posts`);
        expect(post.message).toBeUndefined();
      }
    );
  });
  describe("Topic locking", () => {
    test("only administrators can lock a topic", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          await createSession(conn, userA, true, false, projectId);
          const forum = await conn.one(
            sql`select * from forums where project_id = ${projectId}`
          );
          expect(forum.name).toBe("Forum A");
          await createSession(conn, userA, true, false, projectId);
          const topicId = await conn.oneFirst(
            sql`select id from create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
          );
          await createSession(conn, adminId, true, false, projectId);
          const topic = await conn.one(
            sql`select * from set_topic_locked(${topicId}, true)`
          );
          expect(topic.locked).toBe(true);
          await createSession(conn, userA, true, false, projectId);
          expect(
            conn.one(sql`select * from set_topic_locked(${topicId}, false)`)
          ).rejects.toThrow(/admin/i);
        }
      );
    });
    test("only admins can post to a locked topic", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          const parts = await conn.any(
            sql`update project_participants set share_profile = true returning *`
          );
          await createSession(conn, userA, true, false, projectId);
          const forum = await conn.one(
            sql`select * from forums where project_id = ${projectId}`
          );
          expect(forum.name).toBe("Forum A");
          await createSession(conn, userA, true, false, projectId);
          const topicId = await conn.oneFirst(
            sql`select id from create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
          );
          await createSession(conn, adminId, true, false, projectId);
          const topic = await conn.one(
            sql`select * from set_topic_locked(${topicId}, true)`
          );
          expect(topic.locked).toBe(true);
          const post = await conn.one(
            sql`select * from create_post('{}'::jsonb, ${topic.id}, '<div />')`
          );
          expect(post.author_id).toBe(adminId);
          await createSession(conn, userA, true, false, projectId);
          expect(
            conn.one(
              sql`select * from create_post('{}'::jsonb, ${topic.id}, '<div />')`
            )
          ).rejects.toThrow(/locked/i);
        }
      );
    });
  });
  describe("Revoking posting privileges", () => {
    test("admins can ban a user from posting in the discussion forum", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          await conn.any(
            sql`update project_participants set share_profile = true returning *`
          );
          await createSession(conn, adminId, true, false, projectId);
          await conn.any(
            sql`select disable_forum_posting(${userA}, ${projectId})`
          );
          await createSession(conn, userA, true, false, projectId);
          expect(
            conn.one(
              sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
            )
          ).rejects.toThrow(/disabled/i);
        }
      );
    });

    test("admins can un-ban forum posting", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          await conn.any(
            sql`update project_participants set share_profile = true returning *`
          );
          await createSession(conn, adminId, true, false, projectId);
          await conn.any(
            sql`select disable_forum_posting(${userA}, ${projectId})`
          );
          await conn.any(
            sql`select enable_forum_posting(${userA}, ${projectId})`
          );
          await createSession(conn, userA, true, false, projectId);
          const topic = await conn.one(
            sql`select * from create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
          );
          expect(topic.id).toBeGreaterThan(0);
        }
      );
    });
    test("user.bannedFromForums(projectId) status", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          await conn.any(
            sql`update project_participants set share_profile = true returning *`
          );
          await createSession(conn, adminId, true, false, projectId);
          expect(
            conn.oneFirst(
              sql`select users_banned_from_forums(users.*) from users where id = ${userA}`
            )
          ).resolves.toBe(false);
          await conn.any(
            sql`select disable_forum_posting(${userA}, ${projectId})`
          );
          expect(
            conn.oneFirst(
              sql`select users_banned_from_forums(users.*) from users where id = ${userA}`
            )
          ).resolves.toBe(true);
        }
      );
    });
    test("projects.usersWithDisabledForumAccess lists all users who have been banned from the forum", async () => {
      await projectTransaction(
        pool,
        "invite_only",
        async (conn, projectId, adminId, [userA]) => {
          const forumId = await conn.oneFirst(
            sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
          );
          await conn.any(
            sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
          );
          await conn.any(
            sql`update project_participants set share_profile = true returning *`
          );
          await createSession(conn, adminId, true, false, projectId);
          await conn.any(
            sql`select disable_forum_posting(${userA}, ${projectId})`
          );
          const banned = await conn.any(
            sql`select projects_users_banned_from_forums(projects.*) from projects where id = ${projectId}`
          );
          expect(banned.length).toBe(1);
        }
      );
    });
  });
});

describe("Community guidelines", () => {
  test("admins can create, update, and delete community guidelines for their project's forums", async () => {
    let pid: number;
    await verifyCRUDOpsLimitedToAdmins(pool, {
      create: async (conn, projectId, adminId) => {
        pid = projectId;
        return sql`insert into community_guidelines (project_id, content) values (${projectId}, '{}'::jsonb) returning ${pid}`;
      },
      update: (id) => {
        return sql`update community_guidelines set content = '{"message": "updated"}'::jsonb where project_id = ${pid} returning *`;
      },
      delete: (id) => {
        return sql`delete from community_guidelines where project_id = ${pid}`;
      },
    });
  });
  test("anyone with project access can see community guidelines", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        await conn.any(
          sql`insert into community_guidelines (project_id, content) values (${projectId}, '{"message": "foo"}'::jsonb)`
        );
        await createSession(conn, userA, true, false, projectId);
        const g = await conn.one(
          sql`select * from community_guidelines where project_id = ${projectId}`
        );
        // @ts-ignore
        expect(g.content.message).toBe("foo");
        await createSession(conn);
        expect(
          conn.one(
            sql`select * from community_guidelines where project_id = ${projectId}`
          )
        ).rejects.toThrow(/not found/i);
      }
    );
  });
  test("project.session_has_posts can be used to determine if user should be shown community guidelines before posting", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        const hasPosts = await conn.oneFirst(
          sql`select projects_session_has_posts(projects.*) from projects where id = ${projectId}`
        );
        expect(hasPosts).toBe(true);
      }
    );
  });
});

describe("Sticky threads", () => {
  test("only admins can create sticky topics", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        const forum = await conn.one(
          sql`select * from forums where project_id = ${projectId}`
        );
        expect(forum.name).toBe("Forum A");
        await createSession(conn, userA, true, false, projectId);
        const topicId = await conn.oneFirst(
          sql`select id from create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        await createSession(conn, adminId, true, false, projectId);
        const topic = await conn.one(
          sql`select * from set_topic_sticky(${topicId}, true)`
        );
        expect(topic.sticky).toBe(true);
        await createSession(conn, userA, true, false, projectId);
        expect(
          conn.one(sql`select * from set_topic_sticky(${topicId}, false)`)
        ).rejects.toThrow(/admin/i);
      }
    );
  });
  test("sticky topics appear at the top of the forum", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        const topicA = await conn.oneFirst(
          sql`select id from create_topic(${forumId}, 'Topic A', '{"message": "topic a"}'::jsonb, '<div />')`
        );
        const topicB = await conn.oneFirst(
          sql`select id from create_topic(${forumId}, 'Topic B', '{"message": "topic b"}'::jsonb, '<div />')`
        );
        const topicC = await conn.oneFirst(
          sql`select id from create_topic(${forumId}, 'Topic C', '{"message": "topic c"}'::jsonb, '<div />')`
        );
        const topicD = await conn.oneFirst(
          sql`select id from create_topic(${forumId}, 'Topic D', '{"message": "topic d"}'::jsonb, '<div />')`
        );
        const topicE = await conn.oneFirst(
          sql`select id from create_topic(${forumId}, 'Topic E', '{"message": "topic e"}'::jsonb, '<div />')`
        );
        await clearSession(conn);
        await conn.any(
          sql`update topics set sticky = true where id = ${topicE} or id = ${topicB}`
        );
        await conn.any(
          sql`update posts set created_at = created_at - interval '1 day' where topic_id = ${topicB}`
        );
        await conn.any(
          sql`update posts set created_at = created_at - interval '3 days' where topic_id = ${topicD}`
        );
        await conn.any(
          sql`update posts set created_at = created_at - interval '2 days' where topic_id = ${topicA}`
        );
        // Order should be E, B, c, a, d
        await createSession(conn, userA, true, false, projectId);
        const topics = await conn.many(
          sql`select * from topics where forum_id = ${forumId} order by sticky desc, (
            select lastPostInTopic.created_at
            from posts as lastPostInTopic
            where lastPostInTopic.topic_id = topics.id
            order by lastPostInTopic.created_at desc
            limit 1
          ) desc`
        );
        expect(topics.map((t) => t.id).join(",")).toBe(
          `${topicE},${topicB},${topicC},${topicA},${topicD}`
        );
      }
    );
  });
});

describe("Author profiles", () => {
  test("post.authorProfile includes user profile information", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`update user_profiles set fullname = 'Chad' where user_id =${userA}`
        );
        await conn.any(
          sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        const posts = await conn.any(
          sql`select *, posts_author_profile(posts.*) as "authorProfile" from posts`
        );
        // @ts-ignore
        expect(posts[0].authorProfile).not.toBeUndefined();
        expect(posts[0].authorProfile).toMatch(/Chad/);
      }
    );
  });
  test("posts by users without a shared profile include no profile information, and no message content", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await createSession(conn, userA, true, false, projectId);
        await conn.any(
          sql`update user_profiles set fullname = 'Chad' where user_id =${userA}`
        );
        await conn.any(
          sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        await clearSession(conn);
        await conn.any(
          sql`update project_participants set share_profile=false where user_id =${userA} and project_id = ${projectId}`
        );
        await createSession(conn, userA, true, false, projectId);
        const posts = await conn.any(
          sql`select *, posts_author_profile(posts.*) as "authorProfile" from posts`
        );
        // @ts-ignore
        expect(posts[0].authorProfile).toBe(null);
      }
    );
  });
  test("users must be sharing their profile to post topics and messages", async () => {
    await projectTransaction(
      pool,
      "invite_only",
      async (conn, projectId, adminId, [userA]) => {
        const forumId = await conn.oneFirst(
          sql`insert into forums (project_id, name) values (${projectId}, 'Forum A') returning id`
        );
        await conn.any(
          sql`update access_control_lists set type = 'public' where forum_id_read = ${forumId}`
        );
        await conn.any(
          sql`update project_participants set share_profile=false where user_id =${userA} and project_id = ${projectId}`
        );
        await createSession(conn, userA, true, false, projectId);
        expect(
          conn.any(
            sql`select create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
          )
        ).rejects.toThrow(/profile/i);
      }
    );
  });
});
