# Tarkov Loot Checker

https://tarkov-loot-checker.com

Escape from Tarkov のアイテムを検索して、フリマ価格（PvP / PvE）と、Kappa・タスク・ハイドアウトで必要かどうかを表示するサイトです。

## 仕組み

1. GitHub Actions（`.github/workflows/update-data.yml`）が15分ごとに `scripts/build-data.mjs` を実行し、[tarkov.dev](https://tarkov.dev) から価格・タスク・ハイドアウトのデータを取得します。
2. 取得したデータは `data` ブランチに `regular.json`（PvP）、`pve.json`、`status.json` として保存されます。履歴は残さず、毎回1コミットで上書きします。
3. サイト（`site/` フォルダ）は、そのファイルを `raw.githubusercontent.com` 経由で読み込み、ブラウザの中で検索します。

サーバー側で動くプログラムがないので、`site/` の3ファイルをレンタルサーバーの `public_html` に置くだけで動きます。データの更新でサイトを置き直す必要はありません。

## データの確認

- 最新の取得結果：`data` ブランチの `status.json`
- 手動でデータを更新：GitHub の Actions タブ →「Update data」→「Run workflow」

## 以前のサイト

Next.js 版のコードは `legacy-nextjs` ブランチに残してあります。
