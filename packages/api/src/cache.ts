import redis, { RedisClient } from "redis";

let client: RedisClient;
if (process.env.NODE_ENV !== "test") {
  client = redis.createClient({
    connect_timeout: 5000,
    host: process.env.REDIS_HOST || "127.0.0.1",
  });
} else {
  client = {
    // @ts-ignore
    get: async (key: string, cb: Function) => cb(null),
    // @ts-ignore
    set: async (key: string, value: any, cb: Function) => cb(null),
  };
}

/**
 * Retrieve a key from the cache (redis). If the cache is unavailable, this
 * function will always return null and will not throw exceptions.
 *
 * @param {string} key
 * @returns {(Promise<string | null>)}
 */
async function get(key: string): Promise<string | null> {
  return new Promise(function (resolve, reject) {
    client.get(key, (err, value) => {
      if (err) {
        resolve(null);
      } else {
        resolve(value);
      }
    });
  });
}

/**
 * Set a key in the cache. If the connection to redis is unavailable, this will
 * be a no-op and no exceptions will be thrown.
 *
 * @param {string} key
 * @param {*} value
 * @returns
 */
async function set(key: string, value: any) {
  return new Promise(function (resolve, reject) {
    client.set(key, value, () => {
      resolve();
    });
  });
}

export { get, set };
