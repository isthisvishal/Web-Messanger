import type { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  const xRealIp = request.headers.get("x-real-ip");

  if (process.env.BEHIND_CLOUDFLARE === "true" && cfConnectingIp) {
    return cfConnectingIp;
  }

  if (xRealIp) return xRealIp;

  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";

  return "unknown";
}
