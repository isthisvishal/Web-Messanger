import { prisma } from "@/lib/prisma";

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting ? setting.value : defaultValue;
  } catch (error) {
    console.error(`Failed to get setting ${key}:`, error);
    return defaultValue;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  } catch (error) {
    console.error(`Failed to set setting ${key}:`, error);
    throw error;
  }
}
