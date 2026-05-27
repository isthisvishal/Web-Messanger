import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto/server";

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export async function getActiveSmtpConfig(): Promise<SmtpSettings | null> {
  const config = await prisma.smtpConfig.findFirst({ where: { isActive: true } });
  if (!config) return null;

  return {
    host: decrypt(config.host),
    port: config.port,
    secure: config.secure,
    username: decrypt(config.username),
    password: decrypt(config.password),
    fromName: config.fromName,
    fromEmail: config.fromEmail,
  };
}
