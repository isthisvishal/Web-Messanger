import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { hashIp, generateSecureToken } from "@/lib/crypto/server";
import { sendEmail } from "@/lib/email/sender";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";
import { SignJWT } from "jose";
import { redis } from "@/lib/redis";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

const otpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  code: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
  purpose: z.enum(["LOGIN", "EMAIL_VERIFY", "FORGOT_PASSWORD", "CHANGE_EMAIL"]),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const rl = await applyRateLimit(rateLimiters.verifyOtp, ip);
    if (!rl.success) return rl.response!;

    const body = await request.json();
    const validation = otpSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input" },
        { status: 400, headers: rl.headers }
      );
    }

    const { email, code, purpose } = validation.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid verification code" },
        { status: 401, headers: rl.headers }
      );
    }

    const result = await verifyOtp(user.id, code, purpose);
    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401, headers: rl.headers }
      );
    }

    switch (purpose) {
      case "EMAIL_VERIFY": {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true, lastLoginAt: new Date(), lastLoginIp: hashIp(ip) },
        });
        const userAgent = request.headers.get("user-agent") || undefined;
        await createSession(user.id, ip, userAgent);

        await sendEmail(email, "WELCOME", {
          displayName: user.displayName,
          appName: process.env.NEXT_PUBLIC_APP_NAME || "Web Messenger",
        });

        return NextResponse.json(
          { success: true, message: "Email verified", data: { redirect: "/chat" } },
          { status: 200, headers: rl.headers }
        );
      }

      case "LOGIN": {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), lastLoginIp: hashIp(ip) },
        });
        const userAgent = request.headers.get("user-agent") || undefined;
        await createSession(user.id, ip, userAgent);

        return NextResponse.json(
          { success: true, message: "Login successful", data: { redirect: "/chat" } },
          { status: 200, headers: rl.headers }
        );
      }

      case "FORGOT_PASSWORD": {
        const jti = generateSecureToken(16);
        await redis.set(`reset:jti:${jti}`, user.id, { ex: 900 });

        const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
        const token = await new SignJWT({ userId: user.id, purpose: "reset_password", jti })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("15m")
          .setIssuedAt()
          .sign(secret);

        return NextResponse.json(
          { success: true, message: "Code verified", data: { redirect: `/reset-password?token=${token}` } },
          { status: 200, headers: rl.headers }
        );
      }

      default:
        return NextResponse.json(
          { success: true, message: "Code verified" },
          { status: 200, headers: rl.headers }
        );
    }
  } catch (error) {
    logError("VerifyOTP", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
