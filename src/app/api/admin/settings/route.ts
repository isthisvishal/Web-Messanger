import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSetting, setSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const maxUploadSize = await getSetting("MAX_UPLOAD_SIZE", "15");
    const fileExpiryHours = await getSetting("FILE_EXPIRY_HOURS", "24");

    let totalFiles = 0;
    let totalBytes = 0;
    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        totalFiles = files.length;
        for (const file of files) {
          const stat = fs.statSync(path.join(uploadDir, file));
          totalBytes += stat.size;
        }
      }
    } catch (e) {
      console.error("Failed to read upload directory stats:", e);
    }

    return NextResponse.json({
      success: true,
      data: {
        maxUploadSize: parseFloat(maxUploadSize) || 15,
        fileExpiryHours: parseFloat(fileExpiryHours) || 24,
        stats: {
          totalFiles,
          totalBytes
        }
      }
    });
  } catch (error) {
    console.error("GET admin settings error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { maxUploadSize, fileExpiryHours } = await request.json();

    if (maxUploadSize !== undefined) {
      const sizeNum = parseFloat(maxUploadSize);
      if (isNaN(sizeNum) || sizeNum <= 0) {
        return NextResponse.json({ success: false, error: "Invalid max upload size" }, { status: 400 });
      }
      await setSetting("MAX_UPLOAD_SIZE", sizeNum.toString());
    }

    if (fileExpiryHours !== undefined) {
      const expiryNum = parseFloat(fileExpiryHours);
      if (isNaN(expiryNum) || expiryNum <= 0) {
        return NextResponse.json({ success: false, error: "Invalid file expiry time" }, { status: 400 });
      }
      await setSetting("FILE_EXPIRY_HOURS", expiryNum.toString());
    }

    // Add audit log entry
    await prisma.adminAuditLog.create({
      data: {
        adminId: session.userId,
        action: "UPDATE_UPLOAD_SETTINGS",
        metadata: { maxUploadSize, fileExpiryHours }
      }
    });

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (error) {
    console.error("POST admin settings error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
