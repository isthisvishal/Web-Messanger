import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "wm_session";

const protectedPrefixes = ["/chat", "/settings"];
const adminPrefixes = ["/admin"];
const authPaths = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-otp"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const nonce = btoa(String.fromCharCode(...array));
  const isDev = process.env.NODE_ENV === "development";
  const cspHeader = [
    "default-src 'self'",
    isDev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'`
      : `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    isDev
      ? "connect-src * ws: wss: data:"
      : "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", cspHeader);
    return res;
  };

  const isProtected = protectedPrefixes.some((r) => pathname.startsWith(r));
  if (isProtected && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return withCsp(NextResponse.redirect(url));
  }

  const isAdmin = adminPrefixes.some((r) => pathname.startsWith(r));
  if (isAdmin && !hasSession) {
    return withCsp(NextResponse.redirect(new URL("/login", request.url)));
  }

  const isAuth = authPaths.some((r) => pathname === r);
  if (isAuth && hasSession) {
    return withCsp(NextResponse.redirect(new URL("/chat", request.url)));
  }

  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    pathname.startsWith("/api/")
  ) {
    const origin = request.headers.get("origin");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const host = request.headers.get("host");
    const isDev = process.env.NODE_ENV === "development";
    
    // In dev, allow origins matching the current request host (like a Cloudflare Tunnel) or localhost
    const isAllowedDevOrigin = isDev && origin && host && (
      origin.includes(host) || 
      origin.startsWith("http://localhost:") || 
      origin.startsWith("https://localhost:") || 
      origin.includes("trycloudflare.com")
    );

    if (origin && !origin.startsWith(appUrl) && !isAllowedDevOrigin) {
      return withCsp(NextResponse.json({ error: "CSRF validation failed" }, { status: 403 }));
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  return withCsp(response);
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-otp",
    "/api/:path*",
  ],
};
