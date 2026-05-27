import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hashIp } from "@/lib/crypto/server";
import { defaultTemplates } from "@/lib/email/defaults";
import { z } from "zod";
import { getClientIp } from "@/lib/get-client-ip";
import { logError } from "@/lib/logger";

const templateSchema = z.object({
  type: z.enum(["LOGIN_OTP", "FORGOT_PASSWORD_OTP", "EMAIL_VERIFICATION", "WELCOME", "ACCOUNT_BANNED", "PASSWORD_CHANGED"]),
  subject: z.string().min(1).max(200),
  htmlBody: z.string().min(1),
  textBody: z.string().min(1),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const templates = await prisma.emailTemplate.findMany({ orderBy: { type: "asc" } });

    const allTypes = Object.keys(defaultTemplates) as Array<keyof typeof defaultTemplates>;
    const merged = allTypes.map((type) => {
      const custom = templates.find((t) => t.type === type);
      const def = defaultTemplates[type];
      return {
        type,
        subject: custom?.subject || def.subject,
        htmlBody: custom?.htmlBody || def.htmlBody,
        textBody: custom?.textBody || def.textBody,
        isActive: custom?.isActive ?? true,
        isCustom: !!custom,
        updatedAt: custom?.updatedAt || null,
      };
    });

    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    logError("EmailTemplates_GET", error);
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
    const validation = templateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const data = validation.data;

    await prisma.emailTemplate.upsert({
      where: { type: data.type },
      create: { ...data, updatedBy: session.userId },
      update: { subject: data.subject, htmlBody: data.htmlBody, textBody: data.textBody, updatedBy: session.userId },
    });

    const ip = getClientIp(request);
    await prisma.adminAuditLog.create({
      data: { adminId: session.userId, action: "UPDATE_EMAIL_TEMPLATE", metadata: { type: data.type }, ipHash: hashIp(ip) },
    });

    return NextResponse.json({ success: true, message: "Template saved" });
  } catch (error) {
    logError("EmailTemplates_POST", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
