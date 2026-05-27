import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hashIp } from "@/lib/crypto/server";
import { z } from "zod";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

const schema = z.object({ action: z.enum(["promote", "demote"]) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Only SUPER_ADMIN can manage admin roles" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }

    if (id === session.userId) {
      return NextResponse.json({ success: false, error: "Cannot change your own role" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    if (target.role === "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Cannot modify SUPER_ADMIN" }, { status: 403 });
    }

    const newRole = validation.data.action === "promote" ? "ADMIN" : "USER";
    await prisma.user.update({ where: { id }, data: { role: newRole } });

    const ip = getClientIp(request);
    await prisma.adminAuditLog.create({
      data: {
        adminId: session.userId,
        action: validation.data.action === "promote" ? "MAKE_ADMIN" : "REMOVE_ADMIN",
        targetId: id,
        ipHash: hashIp(ip),
      },
    });

    return NextResponse.json({ success: true, message: `User ${validation.data.action}d to ${newRole}` });
  } catch (error) {
    logError("MakeAdmin", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
