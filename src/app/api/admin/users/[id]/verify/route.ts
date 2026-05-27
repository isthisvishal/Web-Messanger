import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hashIp } from "@/lib/crypto/server";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    if (target.emailVerified) {
      return NextResponse.json({ success: false, error: "User is already verified" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id },
      data: { emailVerified: true },
    });

    const ip = getClientIp(request);
    await prisma.adminAuditLog.create({
      data: {
        adminId: session.userId,
        action: "VERIFY_USER",
        targetId: id,
        metadata: { verifiedEmail: target.email },
        ipHash: hashIp(ip),
      },
    });

    return NextResponse.json({ success: true, message: "User email verified successfully" });
  } catch (error) {
    logError("VerifyUserAdmin", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
