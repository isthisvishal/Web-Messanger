import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createOtp } from "@/lib/auth/otp";
import { sendEmail } from "@/lib/email/sender";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

const schema = z.object({ email: z.string().email().toLowerCase().trim() });

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const body = await request.json();
    const validation = schema.safeParse(body);

    const safeMessage = "If that email exists, a reset code was sent.";

    if (!validation.success) {
      return NextResponse.json({ success: true, message: safeMessage });
    }

    const { email } = validation.data;

    const rl = await applyRateLimit(rateLimiters.forgotPassword, email);
    if (!rl.success) return rl.response!;

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.emailVerified) {
      const otp = await createOtp(user.id, "FORGOT_PASSWORD");
      await sendEmail(email, "FORGOT_PASSWORD_OTP", {
        displayName: user.displayName,
        otp,
        expiryMinutes: "15",
        requestedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: safeMessage,
      data: { email, purpose: "FORGOT_PASSWORD" },
    });
  } catch (error) {
    logError("ForgotPassword", error);
    return NextResponse.json({ success: true, message: "If that email exists, a reset code was sent." });
  }
}
