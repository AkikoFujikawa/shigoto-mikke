import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "しごとみっけ",
  description: "好きから見つかる、まだ知らない未来。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
