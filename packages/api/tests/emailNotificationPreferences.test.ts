import { sql } from "slonik";
import { createPool } from "./pool";
import { createUser, createSession, clearSession } from "./helpers";

const pool = createPool("test");

test("Notification preference records are created for each user", async () => {
  await pool.transaction(async (conn) => {
    const userId = await createUser(conn);
    const frequency = await conn.oneFirst(
      sql`select frequency from email_notification_preferences where user_id = ${userId}`
    );
    expect(frequency).toBe("WEEKLY");
    await conn.any(sql`ROLLBACK`);
  });
});

test("Notification preference select and update operations are limited to the user themselves", async () => {
  await pool.transaction(async (conn) => {
    const userId = await createUser(conn);
    const user2Id = await createUser(conn);
    await createSession(conn, userId, true, false);
    const frequency = await conn.oneFirst(
      sql`select frequency from email_notification_preferences where user_id = ${userId}`
    );
    expect(frequency).toBe("WEEKLY");
    const updatedFreq = await conn.oneFirst(
      sql`update email_notification_preferences set frequency = 'DAILY' where user_id = ${userId} returning frequency`
    );
    expect(updatedFreq).toBe("DAILY");
    await createSession(conn, user2Id, true, false);
    expect(
      conn.oneFirst(
        sql`select frequency from email_notification_preferences where user_id = ${userId}`
      )
    ).rejects.toThrow(/not found/i);
    await conn.any(sql`ROLLBACK`);
  });
});
test("Users can subscribe to weekly or daily updates", async () => {
  await pool.transaction(async (conn) => {
    const userId = await createUser(conn);
    const user2Id = await createUser(conn);
    await createSession(conn, userId, true, false);
    const frequency = await conn.oneFirst(
      sql`select frequency from email_notification_preferences where user_id = ${userId}`
    );
    expect(frequency).toBe("WEEKLY");
    const updatedFreq = await conn.oneFirst(
      sql`update email_notification_preferences set frequency = 'DAILY' where user_id = ${userId} returning frequency`
    );
    expect(updatedFreq).toBe("DAILY");
  });
});
test("Users can unsubscribe from all activity summaries", async () => {
  await pool.transaction(async (conn) => {
    const userId = await createUser(conn);
    const user2Id = await createUser(conn);
    await createSession(conn, userId, true, false);
    const updatedFreq = await conn.oneFirst(
      sql`update email_notification_preferences set frequency = 'NEVER' where user_id = ${userId} returning frequency`
    );
    expect(updatedFreq).toBe("NEVER");
  });
});

test("Users can subscribe to immediate updates on forum posts", async () => {
  await pool.transaction(async (conn) => {
    const userId = await createUser(conn);
    const user2Id = await createUser(conn);
    await createSession(conn, userId, true, false);
    const replyNotifications = await conn.oneFirst(
      sql`update email_notification_preferences set notify_on_reply = true where user_id = ${userId} returning notify_on_reply`
    );
    expect(replyNotifications).toBeTruthy();
  });
});

test("Users can unsubscribe from invite notifications", async () => {
  await pool.transaction(async (conn) => {
    const userId = await createUser(conn);
    const user2Id = await createUser(conn);
    await createSession(conn, userId, true, false);
    await conn.any(
      sql`update email_notification_preferences set unsubscribe_all = true where user_id = ${userId}`
    );
    await clearSession(conn);
    const unsubscribed = await conn.oneFirst(
      sql`select unsubscribed(${userId})`
    );
    expect(unsubscribed).toBe(true);
  });
});
