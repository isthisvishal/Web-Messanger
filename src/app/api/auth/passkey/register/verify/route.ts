import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getSession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { z } from "zod";

const schema = z.object({
  response: z.any(),
  deviceName: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }

    const { response, deviceName } = validation.data;

    const challenge = await redis.get<string>(`passkey:challenge:${session.userId}`);
    if (!challenge) {
      return NextResponse.json({ success: false, error: "Challenge expired" }, { status: 400 });
    }

    const host = request.headers.get("host") || "localhost";
    const hostname = host.split(":")[0];
    const origin = request.headers.get("origin") || `https://${host}`;

    const expectedOrigin = process.env.NODE_ENV === "development" ? origin : (process.env.WEBAUTHN_ORIGIN || "http://localhost:3000");
    const expectedRPID = process.env.NODE_ENV === "development" ? hostname : (process.env.WEBAUTHN_RP_ID || "localhost");

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ success: false, error: "Verification failed" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;

    await prisma.passkey.create({
      data: {
        userId: session.userId,
        credentialId: Buffer.from(credential.id).toString("base64url"),
        credentialPublicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: (credential.transports || []) as string[],
        deviceName: deviceName || "Unnamed passkey",
      },
    });

    await redis.del(`passkey:challenge:${session.userId}`);

    return NextResponse.json({ success: true, message: "Passkey registered successfully" });
  } catch (error) {
    logError("PasskeyRegisterVerify", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
