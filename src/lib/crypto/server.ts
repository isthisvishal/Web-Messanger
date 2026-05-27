import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ENCODING = "base64";

function getEncryptionKey(): Buffer {
  const key = process.env.SERVER_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("SERVER_ENCRYPTION_KEY environment variable is not set");
  }
  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length < 32) {
    throw new Error("SERVER_ENCRYPTION_KEY must be at least 32 bytes (base64 encoded)");
  }
  return keyBuffer.subarray(0, 32);
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);

  const authTag = cipher.getAuthTag();

  return `${iv.toString(ENCODING)}:${encrypted}:${authTag.toString(ENCODING)}`;
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], ENCODING);
  const ciphertext = parts[1];
  const authTag = Buffer.from(parts[2], ENCODING);

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (authTag.length !== TAG_LENGTH) {
    throw new Error("Invalid auth tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, ENCODING, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function timingSafeCompare(a: string, b: string): boolean {
  const maxLen = Math.max(Buffer.byteLength(a, "utf8"), Buffer.byteLength(b, "utf8"));
  const bufA = Buffer.alloc(maxLen);
  const bufB = Buffer.alloc(maxLen);
  bufA.write(a, "utf8");
  bufB.write(b, "utf8");
  const equal = crypto.timingSafeEqual(bufA, bufB);
  return equal && Buffer.byteLength(a, "utf8") === Buffer.byteLength(b, "utf8");
}

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generatePKCEVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generatePKCEChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
