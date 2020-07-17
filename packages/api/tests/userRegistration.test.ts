import { sql } from "slonik";
import { createPool } from "./pool";

const pool = createPool("test");

describe("get_or_create_user_by_sub", () => {
  test("Unrecognized subs from auth0 are automatically registered", async () => {
    await pool.transaction(async (conn) => {
      const id = await conn.oneFirst(
        sql`select get_or_create_user_by_sub('auth0:abc123')`
      );
      expect(id).toBeTruthy();
      const id2 = await conn.oneFirst(
        sql`select get_or_create_user_by_sub('auth0:5432')`
      );
      expect(id2).toBeTruthy();
      expect(id).not.toBe(id2);
      const user = await conn.one(sql`select * from users where id = ${id}`);
      expect(user.id).toBe(id);
      expect(user.onboarded).toBeFalsy();
    });
  });

  test("Recognized subs are not re-registered", async () => {
    await pool.transaction(async (conn) => {
      const id = await conn.oneFirst(
        sql`select get_or_create_user_by_sub('auth0:abc123')`
      );
      expect(id).toBeTruthy();
      const id2 = await conn.oneFirst(
        sql`select get_or_create_user_by_sub('auth0:abc123')`
      );
      expect(id2).toBeTruthy();
      expect(id).toBe(id2);
    });
  });
});
