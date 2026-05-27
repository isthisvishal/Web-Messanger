import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rl = await applyRateLimit(rateLimiters.adminAction, session.userId);
    if (!rl.success) return rl.response!;

    const totalUsers = await prisma.user.count();
    const bannedUsers = await prisma.user.count({ where: { isBanned: true } });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsersResult = await prisma.session.groupBy({
      by: ["userId"],
      where: {
        lastSeenAt: { gte: thirtyDaysAgo },
      },
    });
    const activeUsers = activeUsersResult.length;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const messagesLast24h = await prisma.message.count({
      where: { createdAt: { gte: oneDayAgo } },
    });
    const messagesLast7d = await prisma.message.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    const messagesLast30d = await prisma.message.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    const smtpConfig = await prisma.smtpConfig.findFirst({
      where: { isActive: true },
    });
    const smtpActive = !!smtpConfig;

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        bannedUsers,
        messagesLast24h,
        messagesLast7d,
        messagesLast30d,
        smtpActive,
      },
    });
  } catch (error) {
    logError("AdminStats_GET", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
