import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength, passwordSchema } from "@/lib/auth/password";
import { destroyAllUserSessions } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/sender";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";
import { jwtVerify } from "jose";
import { redis } from "@/lib/redis";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

const schema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const rl = await applyRateLimit(rateLimiters.resetPassword, ip);
    if (!rl.success) return rl.response!;

    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: validation.error.flatten().fieldErrors },
        { status: 400, headers: rl.headers }
      );
    }

    const { token, password } = validation.data;

    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    let payload;
    try {
      const result = await jwtVerify(token, secret);
      payload = result.payload as { userId: string; purpose: string; jti?: string };
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset link" },
        { status: 401, headers: rl.headers }
      );
    }

    if (payload.purpose !== "reset_password" || !payload.jti) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401, headers: rl.headers }
      );
    }

    const storedUserId = await redis.get<string>(`reset:jti:${payload.jti}`);
    if (!storedUserId || storedUserId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: "Token already used or expired" },
        { status: 401, headers: rl.headers }
      );
    }

    await redis.del(`reset:jti:${payload.jti}`);

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json(
        { success: false, error: "Password not strong enough", feedback: strength.feedback },
        { status: 400, headers: rl.headers }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash },
    });

    await destroyAllUserSessions(user.id);

    await sendEmail(user.email, "PASSWORD_CHANGED", {
      displayName: user.displayName,
      changedAt: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: true, message: "Password reset successful. Please log in." },
      { status: 200, headers: rl.headers }
    );
  } catch (error) {
    logError("ResetPassword", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
