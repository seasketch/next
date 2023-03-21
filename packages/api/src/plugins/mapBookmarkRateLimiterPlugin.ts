import { makeWrapResolversPlugin } from "postgraphile";
import { RateLimiterRedis } from "rate-limiter-flexible";
import redis, { RedisClient } from "redis";

let limiter: RateLimiterRedis;
if (process.env.NODE_ENV !== "test") {
  const redisClient = redis.createClient({
    connect_timeout: 5000,
    host: process.env.REDIS_HOST || "127.0.0.1",
  });

  // It is recommended to process Redis errors and setup some reconnection strategy
  redisClient.on("error", (err) => {});

  limiter = new RateLimiterRedis({
    // Basic options
    storeClient: redisClient,
    // 3 bookmarks can be created every 5 seconds per user
    points: 3, // Number of points
    duration: 5, // Per second(s).
    keyPrefix: "mapBookmarks", // must be unique for limiters with different purpose
  });
}

/**
 * Rate limits createMapBookmark mutations to 3 per 5 seconds per user.
 * The screenshot creation process is computationally intensive and should be
 * protected from abuse.
 */
const MapBookmarkRateLimiterPlugin = makeWrapResolversPlugin({
  Mutation: {
    createMapBookmark: (resolve, source, args, context, resolveInfo) => {
      if (limiter) {
        if (context?.user?.sub) {
          console.log(context.user.sub);
          return limiter
            .consume(context.user.sub, 1)
            .then((value) => {
              return resolve(source, args, context, resolveInfo);
            })
            .catch((e) => {
              throw new Error("Rate limited");
            });
        } else {
          throw new Error("You must be logged in to create a bookmark");
        }
      } else {
        return resolve(source, args, context, resolveInfo);
      }
    },
  },
});

export default MapBookmarkRateLimiterPlugin;
