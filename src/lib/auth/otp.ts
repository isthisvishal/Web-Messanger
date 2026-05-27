import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateOtp } from "@/lib/crypto/server";
import type { OtpPurpose } from "@prisma/client";

const BCRYPT_ROUNDS = 12;
const MAX_ATTEMPTS = 3;

const OTP_EXPIRY: Record<OtpPurpose, number> = {
  LOGIN: 10,
  FORGOT_PASSWORD: 15,
  EMAIL_VERIFY: 10,
  CHANGE_EMAIL: 10,
};

export async function createOtp(userId: string, purpose: OtpPurpose): Promise<string> {
  const code = generateOtp();
  if (!code || code.length !== 6) {
    throw new Error("OTP generation failed");
  }

  await prisma.otpCode.updateMany({
    where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY[purpose] * 60 * 1000);

  await prisma.otpCode.create({ data: { userId, purpose, codeHash, expiresAt } });

  // Log the OTP in development mode so it's easy to retrieve from server logs
  if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
    console.log("\n========================================");
    console.log(`[DEV ONLY] OTP for User ID: ${userId}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`OTP Code: ${code}`);
    console.log("========================================\n");
  }

  return code;
}

export async function verifyOtp(
  userId: string,
  code: string,
  purpose: OtpPurpose
): Promise<{ valid: boolean; error?: string }> {
  if (!code || code.length !== 6) {
    return { valid: false, error: "Invalid code format." };
  }

  return await prisma.$transaction(async (tx) => {
    const otpRecord = await tx.otpCode.findFirst({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return { valid: false, error: "No valid OTP found. Please request a new code." };
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await tx.otpCode.update({ where: { id: otpRecord.id }, data: { usedAt: new Date() } });
      return { valid: false, error: "Too many incorrect attempts. Please request a new code." };
    }

    const updated = await tx.otpCode.updateMany({
      where: {
        id: otpRecord.id,
        attempts: otpRecord.attempts,
        usedAt: null,
      },
      data: { attempts: { increment: 1 } },
    });

    if (updated.count === 0) {
      return { valid: false, error: "Verification failed. Please try again." };
    }

    const isValid = await bcrypt.compare(code, otpRecord.codeHash);
    if (!isValid) {
      const remaining = MAX_ATTEMPTS - otpRecord.attempts - 1;
      return {
        valid: false,
        error: remaining > 0
          ? `Incorrect code. ${remaining} attempt(s) remaining.`
          : "Too many incorrect attempts. Please request a new code.",
      };
    }

    await tx.otpCode.update({ where: { id: otpRecord.id }, data: { usedAt: new Date() } });
    return { valid: true };
  });
}

export function getOtpExpiryMinutes(purpose: OtpPurpose): number {
  return OTP_EXPIRY[purpose];
}

export async function cleanupExpiredOtps(): Promise<number> {
  const result = await prisma.otpCode.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
  });
  return result.count;
}
