import { ClientOpts } from "redis";

/** Options for the shared Redis. REDIS_DB selects a logical database so e2e does not share the dev cache. */
export function redisClientOptions(): ClientOpts {
  const raw = process.env.REDIS_DB;
  let db = 0;
  if (raw !== undefined && raw !== "") {
    db = Number(raw);
    if (!Number.isInteger(db) || db < 0) {
      throw new Error(`REDIS_DB must be a non-negative integer, not ${raw}`);
    }
  }
  return {
    connect_timeout: 5000,
    host: process.env.REDIS_HOST || "127.0.0.1",
    password: process.env.REDIS_PASSWORD,
    ...(db > 0 ? { db } : {}),
  };
}
