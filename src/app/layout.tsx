import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "爆款结构迁移引擎",
  description: "从样例拆解到短视频方案脚本的 AI 创作工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
