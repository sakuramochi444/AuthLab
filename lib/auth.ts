import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { appendAudit, mutate, query, Session, User } from "@/lib/db";
import { createToken, digest, DUMMY_PASSWORD_HASH, hashPassword, maskIp, passwordScore, verifyPassword } from "@/lib/security";
export const SESSION_COOKIE = "authlab_session";
async function clientMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || h.get("x-real-ip") || "local", userAgent: (h.get("user-agent") || "Unknown device").slice(0, 180) };
}
export async function currentAuth(): Promise<{ user: User; session: Session } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = digest(token);
  return query((db) => {
    const session = db.sessions.find((item) => item.tokenHash === tokenHash && new Date(item.expiresAt).getTime() > Date.now());
    if (!session) return null;
    const user = db.users.find((item) => item.id === session.userId);
    return user ? { user, session } : null;
  });
}
export async function requireAuth() { const auth = await currentAuth(); if (!auth) redirect("/"); return auth; }
export async function requireAdmin() { const auth = await requireAuth(); if (auth.user.role !== "admin") redirect("/unauthorized"); return auth; }
export async function setSessionCookie(token: string) { (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 28800, priority: "high" }); }
export async function clearSessionCookie() { (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0, priority: "high" }); }
export function buildSession(userId: string, token: string, meta: { ip: string; userAgent: string }): Session {
  const now = new Date();
  return { id: randomUUID(), userId, tokenHash: digest(token), createdAt: now.toISOString(), lastSeenAt: now.toISOString(), expiresAt: new Date(now.getTime() + 28800000).toISOString(), ip: maskIp(meta.ip), userAgent: meta.userAgent };
}
export async function authenticate(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase(), meta = await clientMeta(), key = digest(`${email}|${meta.ip}`);
  if (email.length > 254 || password.length === 0 || password.length > 128) return { ok: false as const, error: "メールアドレスまたはパスワードが違います。" };
  return mutate(async (db) => {
    db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
    const rate = db.rateLimits[key] ?? { failures: 0, blockedUntil: 0 };
    if (rate.blockedUntil > Date.now()) return { ok: false as const, error: `安全のため待機中です。${Math.ceil((rate.blockedUntil - Date.now()) / 1000)}秒後に再試行してください。` };
    const user = db.users.find((item) => item.email === email);
    const verification = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !verification.valid) {
      const failures = rate.failures + 1, delaySeconds = failures < 3 ? 0 : Math.min(300, 2 ** (failures - 2));
      db.rateLimits[key] = { failures, blockedUntil: Date.now() + delaySeconds * 1000 };
      appendAudit(db, { userId: user?.id ?? null, type: "login_failed", detail: `失敗 ${failures}回`, ip: maskIp(meta.ip) });
      return { ok: false as const, error: delaySeconds ? `認証に失敗しました。次の試行まで${delaySeconds}秒お待ちください。` : "メールアドレスまたはパスワードが違います。" };
    }
    if (verification.needsRehash) user.passwordHash = await hashPassword(password);
    delete db.rateLimits[key];
    const token = createToken();
    db.sessions.push(buildSession(user.id, token, meta));
    appendAudit(db, { userId: user.id, type: "login_succeeded", detail: "新しいセッションを開始", ip: maskIp(meta.ip) });
    return { ok: true as const, token };
  });
}
export async function register(emailInput: string, password: string, confirmation: string) {
  const email = emailInput.trim().toLowerCase(), meta = await clientMeta();
  if (email.length > 254 || password.length > 128) return { ok: false as const, error: "入力内容を確認してください。" };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false as const, error: "有効なメールアドレスを入力してください。" };
  if (password !== confirmation) return { ok: false as const, error: "確認用パスワードが一致しません。" };
  if (passwordScore(password) < 3) return { ok: false as const, error: "パスワード強度を「強い」以上にしてください。" };
  const passwordHash = await hashPassword(password);
  return mutate((db) => {
    if (db.users.some((user) => user.email === email)) return { ok: false as const, error: "このメールアドレスは利用できません。" };
    const user: User = { id: randomUUID(), email, passwordHash, role: db.users.length === 0 ? "admin" : "member", createdAt: new Date().toISOString() };
    const token = createToken();
    db.users.push(user); db.sessions.push(buildSession(user.id, token, meta));
    appendAudit(db, { userId: user.id, type: "account_created", detail: user.role === "admin" ? "初回ユーザーを管理者として登録" : "メンバーとして登録", ip: maskIp(meta.ip) });
    return { ok: true as const, token };
  });
}
