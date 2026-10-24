import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-kr";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "캠퍼스 습득물 | 찾았어요",
  description: "캠퍼스에서 발견된 습득물을 등록하고 찾아보세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
