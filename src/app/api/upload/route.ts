import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";
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

async function cleanExpiredFiles(expiryHours: number) {
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) return;

    const files = fs.readdirSync(uploadDir);
    const now = Date.now();
    const expiryMs = expiryHours * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > expiryMs) {
        fs.unlinkSync(filePath);
        console.log(`Deleted expired file: ${file}`);
      }
    }
  } catch (error) {
    console.error("Failed to clean expired files:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Retrieve settings (Fallbacks: 15MB max upload, 24 hours expiry)
    const maxUploadSizeStr = await getSetting("MAX_UPLOAD_SIZE", "15"); // in MB
    const fileExpiryHoursStr = await getSetting("FILE_EXPIRY_HOURS", "24"); // in Hours

    const maxUploadSizeMB = parseFloat(maxUploadSizeStr) || 15;
    const fileExpiryHours = parseFloat(fileExpiryHoursStr) || 24;

    // Trigger cleanup asynchronously
    cleanExpiredFiles(fileExpiryHours).catch(err => console.error("Clean task error:", err));

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    // Validate size limit dynamically
    const maxSizeBytes = maxUploadSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json({
        success: false,
        error: `File exceeds the maximum upload limit of ${maxUploadSizeMB}MB`
      }, { status: 400 });
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
