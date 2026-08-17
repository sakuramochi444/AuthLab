import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
export type Role = "admin" | "member";
export type User = { id: string; email: string; passwordHash: string; role: Role; createdAt: string };
export type Session = { id: string; userId: string; tokenHash: string; createdAt: string; lastSeenAt: string; expiresAt: string; userAgent: string; ip: string };
export type AuditEvent = { id: string; userId: string | null; type: string; detail: string; ip: string; at: string; previousHash: string; hash: string };
export type Database = { users: User[]; sessions: Session[]; audit: AuditEvent[]; rateLimits: Record<string, { failures: number; blockedUntil: number }> };
const dataFile = path.join(process.cwd(), ".data", "auth.json");
const emptyDb = (): Database => ({ users: [], sessions: [], audit: [], rateLimits: {} });
let queue = Promise.resolve();
async function readDb() { try { return JSON.parse(await readFile(dataFile, "utf8")) as Database; } catch { return emptyDb(); } }
async function writeDb(db: Database) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  const temp = `${dataFile}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(db, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temp, dataFile);
}
export async function query<T>(fn: (db: Database) => T | Promise<T>) { await queue; return fn(await readDb()); }
export async function mutate<T>(fn: (db: Database) => T | Promise<T>) {
  let release = () => {};
  const previous = queue;
  queue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { const db = await readDb(); const result = await fn(db); await writeDb(db); return result; } finally { release(); }
}
function auditSigningKey() {
  const key = process.env.AUDIT_SIGNING_KEY;
  if (key && key.length >= 32) return key;
  if (process.env.NODE_ENV === "production") throw new Error("AUDIT_SIGNING_KEY must be at least 32 characters");
  return "local-development-audit-key";
}
export function appendAudit(db: Database, input: Omit<AuditEvent, "id" | "at" | "previousHash" | "hash">) {
  const previousHash = db.audit.at(-1)?.hash ?? "GENESIS";
  const event = { id: randomUUID(), at: new Date().toISOString(), previousHash, ...input };
  const key = auditSigningKey();
  const hash = createHmac("sha256", key).update(JSON.stringify(event)).digest("hex");
  db.audit.push({ ...event, hash });
}
export function verifyAuditChain(events: AuditEvent[]) {
  const key = auditSigningKey();
  let previousHash = "GENESIS";
  for (const event of events) {
    const { hash, ...unsigned } = event;
    if (event.previousHash !== previousHash) return false;
    if (hash !== createHmac("sha256", key).update(JSON.stringify(unsigned)).digest("hex")) return false;
    previousHash = hash;
  }
  return true;
}
