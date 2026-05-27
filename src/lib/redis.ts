import { Redis } from "@upstash/redis";

function createRedisClient(): Redis {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  console.warn("[Redis] Using local Redis. Set Upstash env vars for production.");
  return new Redis({
    url: process.env.REDIS_URL ?? "http://localhost:8079",
    token: process.env.REDIS_TOKEN ?? "local_dev_token",
  });
}

export const redis = createRedisClient();
