import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
export const metadata: Metadata = { title: "AuthLab", description: "セッション認証と認可の学習用アプリ" };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  return <html lang="ja"><body><main>{children}</main></body></html>;
}
