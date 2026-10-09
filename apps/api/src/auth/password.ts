import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const DIGEST_BYTES = 32;
const ITERATIONS = 150_000;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const digest = pbkdf2Sync(password, salt, ITERATIONS, DIGEST_BYTES, "sha256");
  return Buffer.concat([salt, digest]).toString("base64");
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const raw = Buffer.from(stored, "base64");
    if (raw.length !== SALT_BYTES + DIGEST_BYTES) return false;
    const salt = raw.subarray(0, SALT_BYTES);
    const expected = raw.subarray(SALT_BYTES);
    const actual = pbkdf2Sync(password, salt, ITERATIONS, DIGEST_BYTES, "sha256");
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
