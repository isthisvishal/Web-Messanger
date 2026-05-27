import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { createSession } from "@/lib/auth/session";
import { hashIp } from "@/lib/crypto/server";
import { z } from "zod";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

const schema = z.object({ response: z.any() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }

    const { response } = validation.data;

    const credentialId = response.id;
    const passkey = await prisma.passkey.findUnique({
      where: { credentialId },
      include: { user: true },
    });

    if (!passkey) {
      return NextResponse.json({ success: false, error: "Invalid credential" }, { status: 401 });
    }

    if (passkey.user.isBanned) {
      return NextResponse.json({ success: false, error: "Account suspended" }, { status: 403 });
    }

    const userId = passkey.userId;
    const challenge = await redis.get<string>(`passkey:auth:${userId}`);
    if (!challenge) {
      return NextResponse.json({ success: false, error: "Challenge expired" }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: process.env.WEBAUTHN_ORIGIN || "http://localhost:3000",
      expectedRPID: process.env.WEBAUTHN_RP_ID || "localhost",
      credential: {
        id: Buffer.from(passkey.credentialId, "base64url"),
        publicKey: passkey.credentialPublicKey,
        counter: Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransport[],
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ success: false, error: "Verification failed" }, { status: 401 });
    }

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    const ip = getClientIp(request);
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), lastLoginIp: hashIp(ip) },
    });

    const userAgent = request.headers.get("user-agent") || undefined;
    await createSession(userId, ip, userAgent);

    await redis.del(`passkey:auth:${userId}`);

    return NextResponse.json({
      success: true,
      message: "Authentication successful",
      data: { redirect: "/chat" },
    });
  } catch (error) {
    logError("PasskeyAuthVerify", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

type AuthenticatorTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";
