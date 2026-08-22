import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarkov Loot Checker | タルコフ アイテム価値・フリマ価格検索",
  description: "Escape from Tarkov(タルコフ)のアイテム価格、1マスあたりの価値(コスパ)、フリーマーケットとトレーダーの買取価格を瞬時に比較・検索できるツールです。",
  keywords: "Tarkov, タルコフ, EFT, Loot, フリマ, 価格, 1マス, コスパ, ツール",
  openGraph: {
    title: "Tarkov Loot Checker",
    description: "タルコフのアイテム価格、1マスあたりの価値を瞬時に比較・検索。",
    url: "https://www.tarkov-loot-checker.com",
    siteName: "Tarkov Loot Checker",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarkov Loot Checker",
    description: "タルコフのアイテム価格、1マスあたりの価値を瞬時に比較・検索。",
  },
  alternates: {
    canonical: "https://www.tarkov-loot-checker.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        {/* 検索エンジン向けの構造化データ (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Tarkov Loot Checker",
              "url": "https://www.tarkov-loot-checker.com",
              "description": "Escape from Tarkovのアイテム価格、1マスあたりの価値、フリーマーケットとトレーダーの買取価格を瞬時に比較できるツール。",
              "applicationCategory": "GameApplication",
              "operatingSystem": "All"
            }),
          }}
        />
        <style>{`
          /* ベースとなるモバイルファーストのCSS設定 */
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #121212;
            color: #ffffff;
          }
          * {
            box-sizing: border-box;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
