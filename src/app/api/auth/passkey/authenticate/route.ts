import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";
import { z } from "zod";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

const schema = z.object({ email: z.string().email().toLowerCase().trim() });

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await applyRateLimit(rateLimiters.passkeyAuth, ip);
    if (!rl.success) return rl.response!;

    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: validation.data.email },
      include: { passkeys: true },
    });

    if (!user || user.passkeys.length === 0) {
      return NextResponse.json({ success: false, error: "No passkeys found" }, { status: 404 });
    }

    if (user.isBanned) {
      return NextResponse.json({ success: false, error: "Account suspended" }, { status: 403 });
    }

    const host = request.headers.get("host") || "localhost";
    const hostname = host.split(":")[0];
    const rpID = process.env.NODE_ENV === "development" ? hostname : (process.env.WEBAUTHN_RP_ID || "localhost");

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user.passkeys.map((pk) => ({
        id: Buffer.from(pk.credentialId, "base64url"),
        transports: pk.transports as AuthenticatorTransport[],
      })),
      userVerification: "preferred",
    });

    await redis.set(`passkey:auth:${user.id}`, options.challenge, { ex: 300 });

    return NextResponse.json({ success: true, data: { options, userId: user.id } });
  } catch (error) {
    logError("PasskeyAuthInit", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

type AuthenticatorTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";
