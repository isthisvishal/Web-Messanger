import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, destroyAllUserSessions } from "@/lib/auth/session";
import { hashIp } from "@/lib/crypto/server";
import { sendEmail } from "@/lib/email/sender";
import { z } from "zod";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

const schema = z.object({ reason: z.string().min(10, "Ban reason must be at least 10 characters") });

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
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    if (target.role === "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Cannot ban SUPER_ADMIN" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id },
      data: { isBanned: true, banReason: validation.data.reason, bannedAt: new Date(), bannedBy: session.userId },
    });

    await destroyAllUserSessions(id);

    const ip = getClientIp(request);
    await prisma.adminAuditLog.create({
      data: { adminId: session.userId, action: "BAN_USER", targetId: id, metadata: { reason: validation.data.reason }, ipHash: hashIp(ip) },
    });

    await sendEmail(target.email, "ACCOUNT_BANNED", {
      displayName: target.displayName,
      banReason: validation.data.reason,
    });

    return NextResponse.json({ success: true, message: "User banned" });
  } catch (error) {
    logError("BanUser", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
