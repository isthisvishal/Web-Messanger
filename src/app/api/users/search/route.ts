import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rl = await applyRateLimit(rateLimiters.userSearch, session.userId);
    if (!rl.success) return rl.response!;

    const email = request.nextUrl.searchParams.get("email")?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email query parameter is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email, isBanned: false },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        publicIdentityKey: true,
      },
    });

    if (!user || user.id === session.userId) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    logError("UserSearch", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
