import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

export function createRateLimiter(config: {
  prefix: string;
  maxRequests: number;
  windowSeconds: number;
}) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowSeconds} s`),
    prefix: `ratelimit:${config.prefix}`,
    analytics: true,
  });
}

export const rateLimiters = {
  register: createRateLimiter({ prefix: "register", maxRequests: 3, windowSeconds: 3600 }),
  login: createRateLimiter({ prefix: "login", maxRequests: 5, windowSeconds: 900 }),
  verifyOtp: createRateLimiter({ prefix: "verify-otp", maxRequests: 10, windowSeconds: 900 }),
  forgotPassword: createRateLimiter({
    prefix: "forgot-password",
    maxRequests: 3,
    windowSeconds: 3600,
  }),
  resetPassword: createRateLimiter({
    prefix: "reset-password",
    maxRequests: 5,
    windowSeconds: 900,
  }),
  googleAuth: createRateLimiter({ prefix: "google-auth", maxRequests: 10, windowSeconds: 3600 }),
  passkeyAuth: createRateLimiter({
    prefix: "passkey-auth",
    maxRequests: 10,
    windowSeconds: 900,
  }),
  adminAction: createRateLimiter({ prefix: "admin", maxRequests: 100, windowSeconds: 60 }),
  otpSend: createRateLimiter({ prefix: "otp-send", maxRequests: 3, windowSeconds: 3600 }),
  userSearch: createRateLimiter({ prefix: "user-search", maxRequests: 20, windowSeconds: 60 }),
};

export async function applyRateLimit(
  limiter: Ratelimit,
  key: string
): Promise<{ success: boolean; headers: Record<string, string>; response?: NextResponse }> {
  const result = await limiter.limit(key);

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    return {
      success: false,
      headers,
      response: NextResponse.json(
        {
          success: false,
          error: "Too many requests. Please try again later.",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            ...headers,
            "Retry-After": retryAfter.toString(),
          },
        }
      ),
    };
  }

  return { success: true, headers };
}
