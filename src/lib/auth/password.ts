import argon2 from "argon2";
import zxcvbn from "zxcvbn";
import { z } from "zod";

const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_CONFIG);
}

export let DUMMY_HASH = "";

async function initDummyHash() {
  try {
    DUMMY_HASH = await hashPassword("dummy-password-constant-string");
  } catch (err) {
    console.error("[Auth] Failed to initialize dummy hash", err);
  }
}
initDummyHash();

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const hashToVerify = hash || DUMMY_HASH;
    return await argon2.verify(hashToVerify, password);
  } catch {
    return false;
  }
}

export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_CONFIG);
}

const COMMON_PASSWORDS = new Set([
  "password",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "monkey",
  "1234567",
  "letmein",
  "trustno1",
  "dragon",
  "baseball",
  "iloveyou",
  "master",
  "sunshine",
  "ashley",
  "michael",
  "shadow",
  "123123",
  "654321",
  "superman",
  "qazwsx",
  "password1",
  "password123",
  "admin",
  "welcome",
  "hello",
  "charlie",
  "donald",
  "login",
  "starwars",
  "121212",
  "flower",
  "passw0rd",
  "lovely",
  "zaq1zaq1",
  "!@#$%^&*",
  "aa123456",
  "access",
  "football",
  "mustang",
  "696969",
  "batman",
  "!@#$%^&",
  "qwerty123",
  "Password1",
  "1qaz2wsx",
  "qwer1234",
]);

export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];

  if (password.length < 12) {
    feedback.push("Password must be at least 12 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push("Must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    feedback.push("Must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    feedback.push("Must contain at least one number");
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    feedback.push("Must contain at least one special character");
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    feedback.push("This password is too common");
  }

  const result = zxcvbn(password);
  const score = result.score;

  if (score < 3) {
    if (result.feedback.warning) {
      feedback.push(result.feedback.warning);
    }
    result.feedback.suggestions.forEach((s: string) => feedback.push(s));
    if (feedback.length === 0) {
      feedback.push("Password is not strong enough");
    }
  }

  return {
    valid: feedback.length === 0 && score >= 3,
    score,
    feedback,
  };
}

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/, "Must contain at least one special character");
