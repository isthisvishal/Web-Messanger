import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateSecureToken, hashSessionToken, hashIp } from "@/lib/crypto/server";
import type { SessionData } from "@/types";

if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_APP_URL &&
  !process.env.NEXT_PUBLIC_APP_URL.startsWith("https://")
) {
  throw new Error("FATAL: NEXT_PUBLIC_APP_URL must use HTTPS in production");
}

const SESSION_COOKIE_NAME = "wm_session";
const SESSION_EXPIRY_DAYS = 7;

export async function createSession(
  userId: string,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const rawToken = generateSecureToken(32);
  const hashedToken = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      token: hashedToken,
      ipHash: ip ? hashIp(ip) : null,
      userAgent: userAgent?.substring(0, 256) || null,
      expiresAt,
    },
  });

  const isSecure = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
  });

  return rawToken;
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const hashedToken = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  if (session.user.isBanned) return null;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (session.lastSeenAt < oneDayAgo) {
    const newExpiry = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: newExpiry },
    });
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
    displayName: session.user.displayName,
    avatarUrl: session.user.avatarUrl || undefined,
    createdAt: session.createdAt.getTime(),
  };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const hashedToken = hashSessionToken(token);
    await prisma.session.deleteMany({ where: { token: hashedToken } });
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function getSessionFromToken(rawToken: string): Promise<SessionData | null> {
  const hashedToken = hashSessionToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.isBanned) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
    displayName: session.user.displayName,
    avatarUrl: session.user.avatarUrl || undefined,
    createdAt: session.createdAt.getTime(),
  };
}
