"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { appendAudit, mutate } from "@/lib/db";
import { authenticate, clearSessionCookie, currentAuth, register, SESSION_COOKIE, setSessionCookie } from "@/lib/auth";
import { digest, maskIp } from "@/lib/security";
export type FormState = { error?: string };
async function assertSameOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!origin || !host) throw new Error("Invalid request origin");
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error("Invalid request origin"); }
  if (parsed.host !== host || !["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid request origin");
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") throw new Error("HTTPS is required");
}
export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  await assertSameOrigin();
  const result = await authenticate(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!result.ok) return { error: result.error };
  await setSessionCookie(result.token); redirect("/");
}
export async function signupAction(_: FormState, formData: FormData): Promise<FormState> {
  await assertSameOrigin();
  const result = await register(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""), String(formData.get("confirmation") ?? ""));
  if (!result.ok) return { error: result.error };
  await setSessionCookie(result.token); redirect("/");
}
export async function logoutAction() {
  await assertSameOrigin();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = digest(token);
    const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    await mutate((db) => {
      const session = db.sessions.find((item) => item.tokenHash === tokenHash);
      db.sessions = db.sessions.filter((item) => item.tokenHash !== tokenHash);
      if (session) appendAudit(db, { userId: session.userId, type: "logout", detail: "現在のセッションを終了", ip: maskIp(forwarded) });
    });
  }
  await clearSessionCookie(); redirect("/");
}
export async function revokeSessionAction(formData: FormData) {
  await assertSameOrigin();
  const auth = await currentAuth();
  if (!auth) redirect("/");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (sessionId === auth.session.id) return;
  await mutate((db) => {
    const target = db.sessions.find((item) => item.id === sessionId && item.userId === auth.user.id);
    if (!target) return;
    db.sessions = db.sessions.filter((item) => item.id !== target.id);
    appendAudit(db, { userId: auth.user.id, type: "session_revoked", detail: "別端末のセッションを失効", ip: auth.session.ip });
  });
  revalidatePath("/");
}
