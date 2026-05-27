import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import fs from "fs";
import path from "path";

// Allowed extensions
const ALLOWED_EXTENSIONS = new Set([
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  // Videos
  ".mp4", ".webm", ".mov", ".m4v",
  // Audio
  ".mp3", ".wav", ".ogg", ".m4a",
  // Documents
  ".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"
]);

// Blocked terms anywhere in the filename (to prevent double-extension or nested archive bypasses)
const BLOCKED_TERMS = ["zip", "tar", "gz", "rar", "7z", "exe", "bat", "sh", "cmd", "msi", "scr", "pif", "com"];

// 15 MB size limit
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "File exceeds 15MB limit" }, { status: 400 });
    }

    const originalName = file.name || "upload";
    const ext = path.extname(originalName).toLowerCase();

    // Check allowed extension
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ success: false, error: "File type not allowed" }, { status: 400 });
    }

    // Check for double extension or embedded archive formats
    const parts = originalName.toLowerCase().split(".");
    for (const part of parts) {
      if (BLOCKED_TERMS.includes(part)) {
        return NextResponse.json({ success: false, error: "Security check: Dangerous file content blocked" }, { status: 400 });
      }
    }

    // Generate unique name
    const uniqueId = crypto.randomUUID();
    const safeFileName = `${uniqueId}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");

    // Ensure folder exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, safeFileName);
    const buffer = Buffer.from(await file.arrayBuffer());

    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${safeFileName}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: originalName,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream"
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
