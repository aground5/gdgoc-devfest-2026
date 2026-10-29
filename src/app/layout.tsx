import type { Metadata, Viewport } from "next";
import { Google_Sans, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// The design guide sets everything in Google Sans (Latin) + a Korean companion, Regular and Bold only.
// Google Sans has no Hangul, so Korean falls through to Noto Sans KR.
const googleSans = Google_Sans({ variable: "--font-google-sans", subsets: ["latin"], weight: ["400", "700"], adjustFontFallback: false });
const notoSansKr = Noto_Sans_KR({ variable: "--font-noto-kr", weight: ["400", "700"], preload: false });

// viewport-fit=cover lets fixed bars pad themselves with env(safe-area-inset-*) on notched phones
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "GDG DevFest 2026",
  description: "GDG Demo Day — 개발자와 투자자 사이 · 2026. 11. 06 (금) · Google for Startups Campus",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className={`${googleSans.variable} ${notoSansKr.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
