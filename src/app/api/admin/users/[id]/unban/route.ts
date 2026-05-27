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
    if (!target) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }
    if (!target.isBanned) {
      return NextResponse.json({ success: false, error: "User is not banned" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id },
      data: { isBanned: false, banReason: null, bannedAt: null, bannedBy: null },
    });

    const ip = getClientIp(request);
    await prisma.adminAuditLog.create({
      data: { adminId: session.userId, action: "UNBAN_USER", targetId: id, ipHash: hashIp(ip) },
    });

    return NextResponse.json({ success: true, message: "User unbanned" });
  } catch (error) {
    logError("UnbanUser", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
