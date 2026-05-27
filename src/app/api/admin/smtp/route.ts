import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { encrypt, decrypt, hashIp } from "@/lib/crypto/server";
import { sendTestEmail } from "@/lib/email/sender";
import { z } from "zod";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

const smtpSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1),
  password: z.string().min(1),
  fromName: z.string().min(1),
  fromEmail: z.string().email(),
  testEmail: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const config = await prisma.smtpConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        host: decrypt(config.host),
        port: config.port,
        secure: config.secure,
        username: decrypt(config.username),
        fromName: config.fromName,
        fromEmail: config.fromEmail,
        isActive: config.isActive,
        testedAt: config.testedAt,
        testResult: config.testResult,
      },
    });
  } catch (error) {
    logError("SMTP_GET", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = smtpSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const data = validation.data;

    if (data.testEmail) {
      const result = await sendTestEmail(session.email, {
        host: data.host,
        port: data.port,
        secure: data.secure,
        username: data.username,
        password: data.password,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: `SMTP test failed: ${result.error}` }, { status: 400 });
      }
    }

    await prisma.smtpConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });

    await prisma.smtpConfig.create({
      data: {
        host: encrypt(data.host),
        port: data.port,
        secure: data.secure,
        username: encrypt(data.username),
        password: encrypt(data.password),
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        isActive: true,
        createdBy: session.userId,
        testedAt: data.testEmail ? new Date() : null,
        testResult: data.testEmail ? "Success" : null,
      },
    });

    const ip = getClientIp(request);
    await prisma.adminAuditLog.create({
      data: { adminId: session.userId, action: "CHANGE_SMTP", ipHash: hashIp(ip) },
    });

    return NextResponse.json({ success: true, message: "SMTP configuration saved" });
  } catch (error) {
    logError("SMTP_POST", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
