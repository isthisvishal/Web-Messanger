import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, DUMMY_HASH } from "@/lib/auth/password";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";
import { createOtp } from "@/lib/auth/otp";
import { sendEmail } from "@/lib/email/sender";
import { hashIp, timingSafeCompare } from "@/lib/crypto/server";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const body = await request.json();
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    const rl = await applyRateLimit(rateLimiters.login, `${email}:${ip}`);
    if (!rl.success) return rl.response!;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      await verifyPassword("dummy-password-constant-string", DUMMY_HASH);
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401, headers: rl.headers }
      );
    }

    if (user.isBanned) {
      return NextResponse.json(
        { success: false, error: "Account suspended", reason: user.banReason },
        { status: 403, headers: rl.headers }
      );
    }

    if (!user.emailVerified && user.role !== "SUPER_ADMIN") {
      const otp = await createOtp(user.id, "EMAIL_VERIFY");
      await sendEmail(email, "EMAIL_VERIFICATION", {
        displayName: user.displayName,
        otp,
        expiryMinutes: "10",
      });
      return NextResponse.json(
        { success: false, error: "Email not verified", data: { email, purpose: "EMAIL_VERIFY" } },
        { status: 403, headers: rl.headers }
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401, headers: rl.headers }
      );
    }

    if (user.role === "SUPER_ADMIN") {
      const userAgent = request.headers.get("user-agent") || undefined;
      const { createSession } = await import("@/lib/auth/session");
      await createSession(user.id, ip, userAgent);

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: hashIp(ip) },
      });

      return NextResponse.json(
        {
          success: true,
          message: "Login successful",
          data: { redirect: "/chat" },
        },
        { status: 200, headers: rl.headers }
      );
    }

    const otp = await createOtp(user.id, "LOGIN");
    await sendEmail(email, "LOGIN_OTP", {
      displayName: user.displayName,
      otp,
      expiryMinutes: "10",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Verification code sent to your email",
        data: { email, purpose: "LOGIN" },
      },
      { status: 200, headers: rl.headers }
    );
  } catch (error) {
    logError("Login", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
