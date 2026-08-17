import Link from "next/link";
export default function UnauthorizedPage() {
  return <section className="result-page"><div className="seal denied">×</div><div className="eyebrow">403 · FORBIDDEN</div><h1>権限がありません。</h1><p>ログインは確認できましたが、このページには管理者権限が必要です。</p><Link className="secondary link-button" href="/">戻る</Link></section>;
}
