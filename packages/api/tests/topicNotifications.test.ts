import {
  projectTransaction,
  createSession,
  createGroup,
  addUserToGroup,
  clearSession,
  verifyCRUDOpsLimitedToAdmins,
  asPg,
} from "./helpers";
import { createPool } from "./pool";
import { sql } from "slonik";
import {
  generateUnsubscribeToken,
  unsubscribeFromTopic,
} from "../src/activityNotifications/topicNotifications";
import { rotateKeys } from "../src/auth/jwks";

const pool = createPool("test");

describe("Topic notifications", () => {
  test("notifications are queued whenever a user posts to an active discussion", async () => {
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
        await createSession(conn, adminId, true, false, projectId);
        const topicId = await conn.oneFirst(
          sql`select id from create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        await createSession(conn, userA, true, false, projectId);
        const reply1Id = await conn.oneFirst(
          sql`select id from create_post('{}'::jsonb, ${topicId}, '<div />')`
        );
        expect(reply1Id).toBeGreaterThan(0);
        await clearSession(conn);
        const notifications = await conn.any(
          sql`select * from pending_topic_notifications`
        );
        expect(notifications.length).toBe(1);
        expect(notifications[0].topic_id).toBe(topicId);
        expect(notifications[0].user_id).toBe(adminId);
      }
    );
  });
  test("users can unsubscribe from a topic and will no longer recieve notifications", async () => {
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
        await createSession(conn, adminId, true, false, projectId);
        const topicId = await conn.oneFirst(
          sql`select id from create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
        );
        await clearSession(conn);
        await conn.any(
          sql`insert into topic_notification_unsubscribes (topic_id, user_id) values (${topicId}, ${adminId})`
        );
        await createSession(conn, userA, true, false, projectId);
        const reply1Id = await conn.oneFirst(
          sql`select id from create_post('{}'::jsonb, ${topicId}, '<div />')`
        );
        expect(reply1Id).toBeGreaterThan(0);
        await clearSession(conn);
        const notifications = await conn.any(
          sql`select * from pending_topic_notifications`
        );
        expect(notifications.length).toBe(0);
      }
    );
  });
  describe("Notification Emails", () => {
    test.todo("topicNotifications.sendQueuedNotifications() sends emails");
    test("topic notifications include a link to unsubscribe from notifications", async () => {
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
          await createSession(conn, adminId, true, false, projectId);
          const topicId = await conn.oneFirst(
            sql`select id from create_topic(${forumId}, 'Topic A', '{"message": "foo"}'::jsonb, '<div />')`
          );
          await clearSession(conn);
          await rotateKeys(asPg(conn));
          // Generate unsubscribe token and use it for admin
          const token = await generateUnsubscribeToken(
            asPg(conn),
            adminId,
            topicId as number
          );
          await unsubscribeFromTopic(asPg(conn), token);
          await createSession(conn, userA, true, false, projectId);
          const reply1Id = await conn.oneFirst(
            sql`select id from create_post('{}'::jsonb, ${topicId}, '<div />')`
          );
          expect(reply1Id).toBeGreaterThan(0);
          await clearSession(conn);
          const notifications = await conn.any(
            sql`select * from pending_topic_notifications`
          );
          expect(notifications.length).toBe(0);
        }
      );
    });
  });
});
