import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rl = await applyRateLimit(rateLimiters.passkeyAuth, session.userId);
    if (!rl.success) return rl.response!;

    const existingPasskeys = await prisma.passkey.count({ where: { userId: session.userId } });
    if (existingPasskeys >= 10) {
      return NextResponse.json(
        { success: false, error: "Maximum 10 passkeys allowed per account" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { passkeys: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const options = await generateRegistrationOptions({
      rpName: process.env.WEBAUTHN_RP_NAME || "Web Messenger",
      rpID: process.env.WEBAUTHN_RP_ID || "localhost",
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.displayName,
      excludeCredentials: user.passkeys.map((pk) => ({
        id: Buffer.from(pk.credentialId, "base64url"),
        transports: pk.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await redis.set(`passkey:challenge:${user.id}`, options.challenge, { ex: 300 });

    return NextResponse.json({ success: true, data: options });
  } catch (error) {
    logError("PasskeyRegisterInit", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

type AuthenticatorTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";
