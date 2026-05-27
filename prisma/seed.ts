// =============================================================================
// Prisma Seed Script — Seeds default email templates
// =============================================================================
import { PrismaClient, EmailTemplateType } from "@prisma/client";

const prisma = new PrismaClient();

const defaultTemplates = {
  LOGIN_OTP: {
    subject: "Your Messager APP Login Code",
    htmlBody: "<h1>Your Messager APP Login Code</h1><p>Use the code below to complete your login:</p><h2>{{otp}}</h2><p>This code expires in {{expiryMinutes}} minutes.</p>",
    textBody: "Your login code: {{otp}}\n\nThis code expires in {{expiryMinutes}} minutes.",
  },
  FORGOT_PASSWORD_OTP: {
    subject: "Reset Your Messager APP Password",
    htmlBody: "<h1>Password Reset Request</h1><p>Use this code to reset your password:</p><h2>{{otp}}</h2><p>Expires in {{expiryMinutes}} minutes.</p>",
    textBody: "Password reset code: {{otp}}\nExpires in {{expiryMinutes}} minutes.",
  },
  EMAIL_VERIFICATION: {
    subject: "Verify Your Messager APP Email",
    htmlBody: "<h1>Verify Email</h1><p>Enter this code to verify your email:</p><h2>{{otp}}</h2><p>Expires in {{expiryMinutes}} minutes.</p>",
    textBody: "Verification code: {{otp}}\nExpires in {{expiryMinutes}} minutes.",
  },
  WELCOME: {
    subject: "Welcome to Messager APP! 🎉",
    htmlBody: "<h1>Welcome, {{displayName}}!</h1><p>Your secure, end-to-end encrypted messaging account is ready.</p>",
    textBody: "Welcome, {{displayName}}!\n\nYour account is ready.",
  },
  ACCOUNT_BANNED: {
    subject: "Messager APP Account Suspended",
    htmlBody: "<h1>Account Suspended</h1><p>Reason: {{banReason}}</p>",
    textBody: "Your account has been suspended.\nReason: {{banReason}}",
  },
  PASSWORD_CHANGED: {
    subject: "Messager APP Password Changed",
    htmlBody: "<h1>Password Changed</h1><p>Your password was changed at {{changedAt}}.</p>",
    textBody: "Your password was changed at {{changedAt}}.",
  },
};

async function main() {
  console.log("🌱 Seeding database...");

  // Seed email templates
  for (const [type, data] of Object.entries(defaultTemplates)) {
    const templateType = type as EmailTemplateType;
    await prisma.emailTemplate.upsert({
      where: { type: templateType },
      update: {},
      create: {
        type: templateType,
        subject: data.subject,
        htmlBody: data.htmlBody,
        textBody: data.textBody,
        isActive: true,
        updatedBy: "SYSTEM",
      },
    });
  }

  console.log("✅ Database seeded successfully!");
  console.log("");
  console.log("📋 Next steps:");
  console.log("  1. Register your first account — it will become SUPER_ADMIN");
  console.log("  2. Configure SMTP in the admin panel (/admin/smtp)");
  console.log("  3. Start messaging securely!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
