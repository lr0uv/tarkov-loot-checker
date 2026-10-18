// tarkov.dev の配布ファイル（json.tarkov.dev）から価格・タスク・ハイドアウトのデータをまとめて取り、
// サイトがそのまま読める小さめのJSONファイルにして out/ に書き出すスクリプト。
// GitHub Actions が定期的に実行する。手元で試すときは `node scripts/build-data.mjs out`。
//
// tarkov.dev には GraphQL の API（api.tarkov.dev）もあるが、2026年夏から停止が続いているため、
// 同じデータを静的なJSONで配っている json.tarkov.dev を使う。

import fs from 'node:fs';

const BASE = 'https://json.tarkov.dev/';
const OUT_DIR = process.argv[2] || 'out';
const ICON_PREFIX = 'https://assets.tarkov.dev/';

// json.tarkov.dev でのモード名 → このサイトでのファイル名
const MODES = { regular: 'regular', pve: 'pve', 'pvp-season': 'season' };

// tarkov.dev の日本語訳にはトレーダー名がないので、日本のプレイヤーが使う呼び方を自前で持つ
const TRADER_JA = {
  Prapor: 'プラポー', Therapist: 'セラピスト', Fence: 'フェンス', Skier: 'スキアー',
  Peacekeeper: 'ピースキーパー', Mechanic: 'メカニック', Ragman: 'ラグマン', Jaeger: 'イェーガー',
  Lightkeeper: 'ライトキーパー', Ref: 'レフ', 'BTR Driver': 'BTRドライバー',
};

const status = { startedAt: new Date().toISOString(), source: BASE, modes: {}, errors: [] };

async function get(path) {
  const res = await fetch(BASE + path, { headers: { 'User-Agent': 'tarkov-loot-checker (+https://tarkov-loot-checker.com)' } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()).data;
}

// 翻訳ファイルは取れなくても英語や空欄で続ける
const getOptional = path => get(path).catch(e => {
  status.errors.push(e.message);
  return {};
});

async function buildMode(srcMode) {
  const [items, itemsJa, itemsEn, tasks, tasksJa, tasksEn, hideout, hideoutJa, hideoutEn, traders, tradersJa, tradersEn] = await Promise.all([
    get(`${srcMode}/items`),
    getOptional(`${srcMode}/items_ja`),
    getOptional(`${srcMode}/items_en`),
    get(`${srcMode}/tasks`),
    getOptional(`${srcMode}/tasks_ja`),
    getOptional(`${srcMode}/tasks_en`),
    getOptional(`${srcMode}/hideout`),
    getOptional(`${srcMode}/hideout_ja`),
    getOptional(`${srcMode}/hideout_en`),
    getOptional(`${srcMode}/traders`),
    getOptional(`${srcMode}/traders_ja`),
    getOptional(`${srcMode}/traders_en`),
  ]);

  // 名前は「キー」で入っているので、日本語→英語→キーそのものの順で引く
  const ja = (dict, key, fallback = {}) => dict[key] ?? fallback[key] ?? key;
  const en = (dict, key) => dict[key] ?? key;
  const traderName = id => {
    if (!traders[id]) return '';
    const name = ja(tradersJa, traders[id].name, tradersEn);
    return TRADER_JA[name] || name;
  };
  const traderNameEn = id => (traders[id] ? en(tradersEn, traders[id].name) : '');

  // タスク：手渡し(giveItem)と設置(plantItem)だけ数える。findItem は giveItem と重複するため除外
  const taskList = [];
  const taskUses = new Map(); // itemId -> [[taskIndex, count, fir]]
  for (const t of Object.values(tasks.tasks || {})) {
    const idx = taskList.length;
    taskList.push({
      n: ja(tasksJa, t.name, tasksEn),
      ne: en(tasksEn, t.name),
      tr: traderName(t.trader),
      tre: traderNameEn(t.trader),
      k: t.kappaRequired ? 1 : 0,
      lk: t.lightkeeperRequired ? 1 : 0,
    });
    // 同じタスクに同じアイテムの目標が複数ある場合（場所違いの選択肢など）は、多いほうの個数だけ数える
    const perTask = new Map(); // itemId -> [count, fir]
    for (const o of t.objectives || []) {
      if (!['giveItem', 'plantItem'].includes(o.type)) continue;
      // 「いずれか1つを渡す」形式（候補が大量にある）は、特定のアイテムが必要とは言えないので除外
      if ((o.items || []).length > 5) continue;
      for (const id of o.items || []) {
        const prev = perTask.get(id) || [0, 0];
        perTask.set(id, [Math.max(prev[0], o.count || 1), prev[1] || (o.foundInRaid ? 1 : 0)]);
      }
    }
    for (const [id, [count, fir]] of perTask) {
      if (!taskUses.has(id)) taskUses.set(id, []);
      taskUses.get(id).push([idx, count, fir]);
    }
  }

  // ハイドアウト：施設とレベルごとの必要アイテム
  const hideoutList = [];
  const hideoutListEn = []; // 英語表示用（hideoutList と同じ順番）
  const hideoutUses = new Map(); // itemId -> [[hideoutIndex, count, fir]]
  for (const st of Object.values(hideout || {})) {
    for (const lv of st.levels || []) {
      if (!(lv.itemRequirements || []).length) continue;
      const idx = hideoutList.length;
      hideoutList.push(`${ja(hideoutJa, st.name, hideoutEn)} Lv${lv.level}`);
      hideoutListEn.push(`${en(hideoutEn, st.name)} Lv${lv.level}`);
      for (const r of lv.itemRequirements) {
        if (!hideoutUses.has(r.item)) hideoutUses.set(r.item, []);
        hideoutUses.get(r.item).push([idx, r.count || 1, r.attributes?.foundInRaid ? 1 : 0]);
      }
    }
  }

  const rows = Object.values(items.items || {}).map(it => {
    const best = (it.sellToTrader || []).reduce((a, b) => ((b.priceRUB || 0) > (a?.priceRUB || 0) ? b : a), null);
    const row = {
      id: it.id,
      n: ja(itemsJa, it.name, itemsEn),
      e: itemsEn[it.name] ?? '',
      s: ja(itemsJa, it.shortName, itemsEn),
      se: itemsEn[it.shortName] ?? '',
      i: (it.iconLink || '').replace(ICON_PREFIX, ''),
      f: it.lastLowPrice || 0,
      a: it.avg24hPrice || 0,
      w: (it.width || 1) * (it.height || 1), // インベントリで占めるマス数
    };
    if (it.minLevelForFlea) row.ml = it.minLevelForFlea; // フリマに出品できるプレイヤーレベル
    if ((it.types || []).includes('noFlea')) row.nf = 1;
    if (best) row.t = [traderName(best.trader), best.priceRUB || 0, traderNameEn(best.trader)];
    if (taskUses.has(it.id)) row.u = taskUses.get(it.id);
    if (hideoutUses.has(it.id)) row.h = hideoutUses.get(it.id);
    return row;
  });

  const lastScan = Object.values(items.items || {}).reduce((m, it) => (it.lastScan > m ? it.lastScan : m), '');
  return {
    mode: srcMode,
    updatedAt: lastScan || new Date().toISOString(), // tarkov.dev がフリマを最後に調べた時刻
    builtAt: new Date().toISOString(),
    iconPrefix: ICON_PREFIX,
    tasks: taskList,
    hideout: hideoutList,
    hideoutEn: hideoutListEn,
    items: rows,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [srcMode, outName] of Object.entries(MODES)) {
    try {
      const data = await buildMode(srcMode);
      if (!data.items.length) throw new Error('items が空でした');
      fs.writeFileSync(`${OUT_DIR}/${outName}.json`, JSON.stringify(data));
      status.modes[outName] = {
        ok: true,
        items: data.items.length,
        withFleaPrice: data.items.filter(i => i.f).length,
        tasks: data.tasks.length,
        hideoutLevels: data.hideout.length,
        updatedAt: data.updatedAt,
      };
    } catch (e) {
      // 失敗したモードは前回のファイルを残す（消さない）
      status.modes[outName] = { ok: false, error: String(e.message || e).slice(0, 600) };
    }
  }
  status.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${OUT_DIR}/status.json`, JSON.stringify(status, null, 2));
  console.log(JSON.stringify(status, null, 2));

  // 1つもモードが取れなかったときだけ失敗として終える
  if (!Object.values(status.modes).some(m => m.ok)) process.exitCode = 1;
}

main().catch(e => {
  status.errors.push(`fatal: ${e.message}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(`${OUT_DIR}/status.json`, JSON.stringify(status, null, 2));
  console.error(e);
  process.exitCode = 1;
});
