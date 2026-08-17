import bcrypt from "bcryptjs";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const BCRYPT_COST = 12;
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("invalid-password-placeholder", BCRYPT_COST);
export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}
export async function verifyPassword(password: string, stored: string) {
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return { valid: await bcrypt.compare(password, stored), needsRehash: bcrypt.getRounds(stored) < BCRYPT_COST };
  }
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex || !/^[a-f0-9]+$/i.test(expectedHex)) return { valid: false, needsRehash: false };
  const expected = Buffer.from(expectedHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return { valid: expected.length === actual.length && timingSafeEqual(expected, actual), needsRehash: true };
}
export const createToken = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export { passwordScore } from "./password-policy.ts";
export function maskIp(ip: string) {
  if (ip === "::1" || ip === "127.0.0.1") return "local";
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::`;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : "local";
}
