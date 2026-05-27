import nodemailer from "nodemailer";
import { getActiveSmtpConfig } from "@/lib/email/smtp";
import { renderTemplate } from "@/lib/email/templates";
import type { EmailTemplateType } from "@prisma/client";

export async function sendEmail(
  to: string,
  templateType: EmailTemplateType,
  variables: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const smtpConfig = await getActiveSmtpConfig();
    if (!smtpConfig) {
      console.error("No active SMTP configuration found");
      return { success: false, error: "Email service not configured" };
    }

    const { subject, html, text } = await renderTemplate(templateType, variables);

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: { user: smtpConfig.username, pass: smtpConfig.password },
    });

    await transporter.sendMail({
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
      to,
      subject,
      html,
      text,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    console.error("Email send failed:", message);
    return { success: false, error: message };
  }
}

export async function sendTestEmail(
  to: string,
  smtpSettings: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromName: string;
    fromEmail: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      auth: { user: smtpSettings.username, pass: smtpSettings.password },
    });

    await transporter.sendMail({
      from: `"${smtpSettings.fromName}" <${smtpSettings.fromEmail}>`,
      to,
      subject: "Web Messenger — SMTP Test",
      html: "<h2>✅ SMTP Configuration Working</h2><p>This is a test email from Web Messenger.</p>",
      text: "SMTP Configuration Working — Test email from Web Messenger",
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
