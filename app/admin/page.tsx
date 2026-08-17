import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
export default async function AdminPage() {
  await requireAdmin();
  const count = await query((db) => db.users.length);
  return <section className="result-page"><div className="seal">✓</div><div className="eyebrow">AUTHORIZED · ADMIN ONLY</div><h1>管理者として認可されました。</h1><p>このページは認証済みかつ role が admin のユーザーだけ表示できます。現在の登録ユーザー数は {count} 人です。</p><Link className="primary link-button" href="/">戻る</Link></section>;
}
