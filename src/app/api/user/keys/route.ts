import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { logError } from "@/lib/logger";

const keysSchema = z.object({
  publicIdentityKey: z.string().min(10),
  encryptedIdentityKey: z.string().min(10),
  encryptedKeyBlob: z.string().min(10),
  keyBlobSalt: z.string().min(10),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get("userId");

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          publicIdentityKey: true,
        },
      });

      if (!user) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: user });
    }

    const userKeys = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        publicIdentityKey: true,
        encryptedIdentityKey: true,
        encryptedKeyBlob: true,
        keyBlobSalt: true,
      },
    });

    return NextResponse.json({ success: true, data: userKeys });
  } catch (error) {
    logError("Keys_GET", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = keysSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid keys data", details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { publicIdentityKey, encryptedIdentityKey, encryptedKeyBlob, keyBlobSalt } = validation.data;

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        publicIdentityKey,
        encryptedIdentityKey,
        encryptedKeyBlob,
        keyBlobSalt,
      },
    });

    return NextResponse.json({ success: true, message: "Keys registered successfully" });
  } catch (error) {
    logError("Keys_POST", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
