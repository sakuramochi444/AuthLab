import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { logoutAction, revokeSessionAction } from "@/app/actions";
import { currentAuth } from "@/lib/auth";
import { query, verifyAuditChain } from "@/lib/db";
function deviceName(agent: string) {
  const browser = agent.includes("Edg/") ? "Edge" : agent.includes("Chrome/") ? "Chrome" : agent.includes("Firefox/") ? "Firefox" : agent.includes("Safari/") ? "Safari" : "ブラウザ";
  const os = agent.includes("Windows") ? "Windows" : agent.includes("Mac OS") ? "macOS" : agent.includes("Linux") ? "Linux" : "不明なOS";
  return `${browser} / ${os}`;
}
const labels: Record<string, string> = { account_created: "アカウント作成", login_succeeded: "ログイン成功", login_failed: "ログイン失敗", session_revoked: "セッション失効", logout: "ログアウト" };
export default async function Home() {
  const auth = await currentAuth();
  if (!auth) return <section className="auth-page"><div className="intro"><h1>認証デモ</h1><p>新規登録またはログインしてください。</p></div><AuthForm /></section>;
  const { user, session } = auth;
  const data = await query((db) => ({ sessions: db.sessions.filter((item) => item.userId === user.id && new Date(item.expiresAt).getTime() > Date.now()), events: db.audit.filter((item) => item.userId === user.id).slice(-8).reverse(), chainOk: verifyAuditChain(db.audit) }));
  return <section className="dashboard">
    <div className="page-head"><div><h1>ログインしています</h1><p>{user.email}</p></div><form action={logoutAction}><button className="secondary">ログアウト</button></form></div>
    <dl className="summary"><div><dt>権限</dt><dd>{user.role === "admin" ? "管理者" : "メンバー"}</dd></div><div><dt>セッション</dt><dd>{data.sessions.length}台</dd></div><div><dt>監査ログ</dt><dd className={data.chainOk ? "safe" : "danger"}>{data.chainOk ? "正常" : "不整合"}</dd></div></dl>
    <div className="content-grid">
      <section className="box"><h2>ログイン中の端末</h2>{data.sessions.map((item) => <div className="session" key={item.id}><div><strong>{deviceName(item.userAgent)}</strong><p>{item.ip} / {new Date(item.createdAt).toLocaleString("ja-JP")}</p></div>{item.id === session.id ? <span className="tag">この端末</span> : <form action={revokeSessionAction}><input type="hidden" name="sessionId" value={item.id} /><button className="text-button">失効する</button></form>}</div>)}</section>
      <section className="box"><h2>セキュリティ履歴</h2>{data.events.length === 0 && <p className="muted">履歴はありません。</p>}{data.events.map((event) => <div className="event" key={event.id}><div><strong>{labels[event.type] ?? event.type}</strong><p>{event.detail} / {event.ip}</p></div><time>{new Date(event.at).toLocaleString("ja-JP")}</time></div>)}</section>
    </div>
    <section className="admin-link"><div><h2>認可の確認</h2><p>管理者だけが開けるページです。</p></div><Link className="secondary link-button" href="/admin">管理者ページ</Link></section>
  </section>;
}
