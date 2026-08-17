"use client";
import { useFormStatus } from "react-dom";
import { useActionState, useMemo, useState } from "react";
import { FormState, loginAction, signupAction } from "@/app/actions";
import { passwordScore } from "@/lib/password-policy";
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="primary" disabled={pending}>{pending ? "処理中…" : label}</button>;
}
export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [loginState, loginFormAction] = useActionState<FormState, FormData>(loginAction, {});
  const [signupState, signupFormAction] = useActionState<FormState, FormData>(signupAction, {});
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const score = useMemo(() => passwordScore(password), [password]);
  const state = mode === "login" ? loginState : signupState;
  const labels = ["未入力", "弱い", "普通", "強い", "とても強い"];
  return <div className="auth-card">
    <div className="tabs" role="tablist" aria-label="認証方法">
      <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>新規登録</button>
      <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>ログイン</button>
    </div>
    <form action={mode === "login" ? loginFormAction : signupFormAction} className="auth-form">
      <label>メールアドレス<input name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} placeholder="you@example.com" /></label>
      <label>パスワード<span className="password-wrap"><input name="password" type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="peek" onClick={() => setVisible(!visible)} aria-label="パスワードの表示を切り替える">{visible ? "隠す" : "表示"}</button></span></label>
      {mode === "signup" && <>
        <div className="strength" aria-live="polite"><span className={`strength-fill strength-${score}`} /><small>強度: {labels[score]}</small></div>
        <label>確認用パスワード<input name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} /></label>
        <p className="hint">12文字以上で、大文字・小文字・数字・記号を組み合わせてください。</p>
      </>}
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <SubmitButton label={mode === "login" ? "ログイン" : "登録する"} />
    </form>
  </div>;
}
