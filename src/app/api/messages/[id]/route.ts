import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        conversation: { include: { members: true } },
      },
    });

    if (!message) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const isMember = message.conversation.members.some((m) => m.userId === session.userId);
    if (!isMember) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    logError("MessageDetail_GET", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
