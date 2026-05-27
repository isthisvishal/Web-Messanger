import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens, getGoogleUser } from "@/lib/auth/google";
import { decrypt, encrypt as encryptField, hashIp } from "@/lib/crypto/server";
import { createSession } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error || !code || !state) {
      return NextResponse.redirect(new URL("/login?error=oauth_denied", request.url));
    }

    const cookieStore = await cookies();

    const storedState = cookieStore.get("oauth_state")?.value;
    const storedVerifier = cookieStore.get("oauth_verifier")?.value;

    if (!storedState || !storedVerifier) {
      return NextResponse.redirect(new URL("/login?error=oauth_expired", request.url));
    }

    const expectedState = decrypt(storedState);
    if (state !== expectedState) {
      return NextResponse.redirect(new URL("/login?error=oauth_invalid", request.url));
    }

    const codeVerifier = decrypt(storedVerifier);

    cookieStore.delete("oauth_state");
    cookieStore.delete("oauth_verifier");

    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const googleUser = await getGoogleUser(tokens.access_token);

    if (!googleUser.email_verified) {
      return NextResponse.redirect(new URL("/login?error=email_not_verified", request.url));
    }

    const ip = getClientIp(request);

    let oauthAccount = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: googleUser.sub } },
      include: { user: true },
    });

    let userId: string;

    if (oauthAccount) {
      if (oauthAccount.user.isBanned) {
        return NextResponse.redirect(new URL("/login?error=account_banned", request.url));
      }
      userId = oauthAccount.userId;

      await prisma.oAuthAccount.update({
        where: { id: oauthAccount.id },
        data: {
          accessToken: encryptField(tokens.access_token),
          refreshToken: tokens.refresh_token ? encryptField(tokens.refresh_token) : undefined,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });
    } else {
      const existingUser = await prisma.user.findUnique({ where: { email: googleUser.email } });

      if (existingUser) {
        if (existingUser.isBanned) {
          return NextResponse.redirect(new URL("/login?error=account_banned", request.url));
        }
        userId = existingUser.id;

        await prisma.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: "google",
            providerAccountId: googleUser.sub,
            accessToken: encryptField(tokens.access_token),
            refreshToken: tokens.refresh_token ? encryptField(tokens.refresh_token) : undefined,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          },
        });

        if (!existingUser.emailVerified) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: true },
          });
        }
      } else {
        const { user: newUser } = await prisma.$transaction(async (tx) => {
          const existingAdminCount = await tx.user.count({ where: { role: "SUPER_ADMIN" } });
          const assignedRole = existingAdminCount === 0 ? "SUPER_ADMIN" : "USER";
          const createdUser = await tx.user.create({
            data: {
              email: googleUser.email,
              displayName: googleUser.name,
              avatarUrl: googleUser.picture,
              emailVerified: true,
              role: assignedRole,
              lastLoginIp: hashIp(ip),
              lastLoginAt: new Date(),
            },
          });
          return { user: createdUser };
        });

        await prisma.oAuthAccount.create({
          data: {
            userId: newUser.id,
            provider: "google",
            providerAccountId: googleUser.sub,
            accessToken: encryptField(tokens.access_token),
            refreshToken: tokens.refresh_token ? encryptField(tokens.refresh_token) : undefined,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          },
        });

        userId = newUser.id;
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), lastLoginIp: hashIp(ip) },
    });

    const userAgent = request.headers.get("user-agent") || undefined;
    await createSession(userId, ip, userAgent);

    return NextResponse.redirect(new URL("/chat", request.url));
  } catch (error) {
    logError("GoogleCallback", error);
    return NextResponse.redirect(new URL("/login?error=oauth_error", request.url));
  }
}
