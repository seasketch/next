import { makeWrapResolversPlugin } from "postgraphile";
import { RateLimiterRedis } from "rate-limiter-flexible";
import redis, { RedisClient } from "redis";

let limiter: RateLimiterRedis;
if (process.env.NODE_ENV !== "test") {
  const redisClient = redis.createClient({
    connect_timeout: 5000,
    host: process.env.REDIS_HOST || "127.0.0.1",
    password: process.env.REDIS_PASSWORD,
  });

  // It is recommended to process Redis errors and setup some reconnection strategy
  redisClient.on("error", (err) => {});

  limiter = new RateLimiterRedis({
    storeClient: redisClient,
    // 200 search queries every 60 seconds
    points: 200, // Number of points
    duration: 60, // Per second(s).
    // must be unique for limiters with different purpose
    keyPrefix: "searchOverlays",
  });
}

/**
 * Rate limits createMapBookmark mutations to 3 per 5 seconds per user.
 * The screenshot creation process is computationally intensive and should be
 * protected from abuse.
 */
const SearchOverlaysRateLimiterPlugin = makeWrapResolversPlugin({
  Query: {
    searchOverlays: (resolve, source, args, context, resolveInfo) => {
      if (limiter) {
        return limiter
          .consume(context.user?.sub || "anon", 1)
          .then((value) => {
            return resolve(source, args, context, resolveInfo);
          })
          .catch((e) => {
            if ("remainingPoints" in e) {
              throw new Error("Rate limited");
            } else {
              throw e;
            }
          });
      } else {
        return resolve(source, args, context, resolveInfo);
      }
    },
  },
});

export default SearchOverlaysRateLimiterPlugin;
