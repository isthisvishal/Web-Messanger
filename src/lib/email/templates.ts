import { prisma } from "@/lib/prisma";
import { defaultTemplates } from "@/lib/email/defaults";
import type { EmailTemplateType } from "@prisma/client";

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderTemplate(
  type: EmailTemplateType,
  variables: Record<string, string>
): Promise<RenderedEmail> {
  let template = await prisma.emailTemplate.findUnique({ where: { type } });

  const defaults = defaultTemplates[type];
  const subject = template?.isActive ? template.subject : defaults.subject;
  const htmlBody = template?.isActive ? template.htmlBody : defaults.htmlBody;
  const textBody = template?.isActive ? template.textBody : defaults.textBody;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

  const replace = (str: string, escape: boolean) => {
    let result = str;
    for (const [key, value] of Object.entries(variables)) {
      const safeValue = escape ? escapeHtml(String(value)) : String(value);
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), safeValue);
    }
    return result;
  };

  return {
    subject: replace(subject, false),
    html: replace(htmlBody, true),
    text: replace(textBody, false),
  };
}
