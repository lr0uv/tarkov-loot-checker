const fs = require('fs');
const https = require('https');

// 外部の信頼できるマスターデータURL（例: コミュニティ等で管理されている静的JSONのURL、または自前のフォールバック）
// ※実際の環境に合わせて、全アイテムデータが格納されているRAWのURLを指定します
const MASTER_JSON_URL = 'https://raw.githubusercontent.com/TarkovTracker/tarkov-data/master/items.json'; 

console.log("最新のアイテムデータを取得しています...");

https.get(MASTER_JSON_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      // 取得したデータをパースして構造を確認
      const items = JSON.parse(data);
      console.log(`取得成功: ${items.length} 件のアイテムデータを処理します。`);

      // 必要に応じてアプリ側で扱いやすい形に整形（今回はそのまま保存、または整形ロジックを挟む）
      // publicフォルダに保存
      if (!fs.existsSync('./public')) {
        fs.mkdirSync('./public');
      }

      fs.writeFileSync('./public/items.json', JSON.stringify(items, null, 2), 'utf-8');
      console.log("✅ public/items.json の更新が完了しました！");
    } catch (e) {
      console.error("JSONのパースに失敗しました:", e.message);
      process.exit(1);
    }
  });

}).on('error', (err) => {
  console.error("データのダウンロードに失敗しました:", err.message);
  process.exit(1);
});
