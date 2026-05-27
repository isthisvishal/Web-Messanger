import { NextRequest, NextResponse } from "next/server";
import { generateGoogleAuthUrl } from "@/lib/auth/google";
import { encrypt } from "@/lib/crypto/server";
import { rateLimiters, applyRateLimit } from "@/lib/ratelimit";
import { cookies } from "next/headers";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await applyRateLimit(rateLimiters.googleAuth, ip);
    if (!rl.success) return rl.response!;

    const { url, state, codeVerifier } = generateGoogleAuthUrl();

    const cookieStore = await cookies();

    cookieStore.set("oauth_state", encrypt(state), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 120,
      path: "/api/auth/google/callback",
    });

    cookieStore.set("oauth_verifier", encrypt(codeVerifier), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 120,
      path: "/api/auth/google/callback",
    });

    return NextResponse.redirect(url);
  } catch (error) {
    logError("GoogleOAuthInit", error);
    return NextResponse.redirect(new URL("/login?error=oauth_error", request.url));
  }
}
