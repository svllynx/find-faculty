import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing, kept free of any Next.js import so plain Node scripts
 * (the seeder, migrations) can reuse the exact same format.
 * Stored form: "<salt hex>:<derived key hex>".
 */

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, KEYLEN).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length === 0) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
