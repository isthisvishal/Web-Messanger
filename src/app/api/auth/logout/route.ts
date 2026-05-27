import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { logError } from "@/lib/logger";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true, message: "Logged out" });
  } catch (error) {
    logError("Logout", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
