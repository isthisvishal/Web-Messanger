import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength, passwordSchema } from "@/lib/auth/password";
import { createOtp } from "@/lib/auth/otp";
import { sendEmail } from "@/lib/email/sender";
import { hashIp } from "@/lib/crypto/server";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";

const registerSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  displayName: z.string().min(2, "Name must be at least 2 characters").max(50).trim(),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const rl = await applyRateLimit(rateLimiters.register, ip);
    if (!rl.success) return rl.response!;

    const body = await request.json();
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: validation.error.flatten().fieldErrors },
        { status: 400, headers: rl.headers }
      );
    }

    const { email, displayName, password } = validation.data;

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json(
        { success: false, error: "Password not strong enough", feedback: strength.feedback },
        { status: 400, headers: rl.headers }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.emailVerified) {
        return NextResponse.json(
          { success: false, error: "An account with this email already exists" },
          { status: 409, headers: rl.headers }
        );
      } else {
        // Delete the unverified user to allow the new registration attempt to succeed
        await prisma.user.delete({ where: { id: existing.id } });
      }
    }

    const passwordHash = await hashPassword(password);

    const { user, role } = await prisma.$transaction(async (tx) => {
      const existingAdminCount = await tx.user.count({ where: { role: "SUPER_ADMIN" } });
      const assignedRole = existingAdminCount === 0 ? "SUPER_ADMIN" : "USER";
      const createdUser = await tx.user.create({
        data: {
          email,
          displayName,
          passwordHash,
          role: assignedRole,
          lastLoginIp: hashIp(ip),
          emailVerified: assignedRole === "SUPER_ADMIN",
        },
      });
      return { user: createdUser, role: assignedRole };
    });

    if (role === "SUPER_ADMIN") {
      const userAgent = request.headers.get("user-agent") || undefined;
      const { createSession } = await import("@/lib/auth/session");
      await createSession(user.id, ip, userAgent);

      return NextResponse.json(
        {
          success: true,
          message: "Registration successful. Super Admin account auto-verified.",
          data: { email, redirect: "/chat", isSuperAdmin: true },
        },
        { status: 201, headers: rl.headers }
      );
    }

    const otp = await createOtp(user.id, "EMAIL_VERIFY");

    await sendEmail(email, "EMAIL_VERIFICATION", {
      displayName,
      otp,
      expiryMinutes: "10",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Registration successful. Please verify your email.",
        data: { email, purpose: "EMAIL_VERIFY", isSuperAdmin: false },
      },
      { status: 201, headers: rl.headers }
    );
  } catch (error) {
    logError("Registration", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
