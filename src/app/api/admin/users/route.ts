import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { z } from "zod";
import { logError } from "@/lib/logger";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  search: z.string().optional(),
  filter: z.enum(["all", "admins", "banned", "active"]).default("all"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const rl = await applyRateLimit(rateLimiters.adminAction, session.userId);
    if (!rl.success) return rl.response!;

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(params);
    const pageSize = 20;
    const skip = (query.page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: "insensitive" } },
        { displayName: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.filter === "admins") where.role = { in: ["ADMIN", "SUPER_ADMIN"] };
    if (query.filter === "banned") where.isBanned = true;
    if (query.filter === "active") where.isBanned = false;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, displayName: true, avatarUrl: true,
          role: true, isBanned: true, emailVerified: true,
          createdAt: true, lastLoginAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      total,
      page: query.page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    logError("AdminUsers_GET", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
