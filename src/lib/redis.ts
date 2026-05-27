import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    redisClient = new Redis({ url, token });
    return redisClient;
  }

  if (process.env.NODE_ENV === "production") {
    // Prevent build-time compilation failures when Redis is not yet configured on the host
    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.IS_BUILD_STAGE === "true"
    ) {
      return new Redis({
        url: "http://localhost:8079",
        token: "build_time_dummy",
      });
    }
    throw new Error(
      "FATAL: Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  console.warn("[Redis] Using local Redis. Set Upstash env vars for production.");
  redisClient = new Redis({
    url: process.env.REDIS_URL ?? "http://localhost:8079",
    token: process.env.REDIS_TOKEN ?? "local_dev_token",
  });
  return redisClient;
}

// Export a proxy to defer instantiation until the first command is executed
export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const client = getRedisClient();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

