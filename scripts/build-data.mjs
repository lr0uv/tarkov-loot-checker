// tarkov.dev から価格・タスク・ハイドアウトのデータをまとめて取り、
// サイトがそのまま読める小さめのJSONファイルにして out/ に書き出すスクリプト。
// GitHub Actions が定期的に実行する。手元で試すときは `node scripts/build-data.mjs`。

import fs from 'node:fs';

const API_URL = 'https://api.tarkov.dev/graphql';
const OUT_DIR = process.argv[2] || 'out';
const ICON_PREFIX = 'https://assets.tarkov.dev/';

const status = { startedAt: new Date().toISOString(), modes: {}, errors: [] };

async function gql(query, variables = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'tarkov-loot-checker (+https://tarkov-loot-checker.com)',
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!json.data && !json.errors) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  if (json.errors?.length) {
    const msg = `HTTP ${res.status}: ` + json.errors.map(e => e.message || JSON.stringify(e)).join(' / ');
    // 一部の項目だけ失敗した場合でも data が返ることがあるので、data が無いときだけ失敗扱い
    if (!json.data) throw new Error(msg);
    status.errors.push(`partial: ${msg.slice(0, 300)}`);
  }
  return json.data;
}

// 書き方の候補を順に試し、最初に通ったものを使う（APIの項目名が変わっても止まりにくくするため）
async function firstWorking(label, attempts) {
  const errs = [];
  for (const run of attempts) {
    try {
      return await run();
    } catch (e) {
      errs.push(String(e.message || e).slice(0, 300));
    }
  }
  throw new Error(`${label}: ${errs.join(' | ')}`);
}

async function detectModes() {
  try {
    const data = await gql('{ __type(name: "GameMode") { enumValues { name } } }');
    const names = (data.__type?.enumValues || []).map(v => v.name);
    if (names.length) return names;
  } catch (e) {
    status.errors.push(`detectModes: ${e.message.slice(0, 300)}`);
  }
  return ['regular', 'pve'];
}

const ITEMS_QUERY = `query ($mode: GameMode) {
  items(gameMode: $mode, lang: ja) {
    id name shortName iconLink types avg24hPrice lastLowPrice
    sellFor { priceRUB vendor { name normalizedName } }
  }
}`;

const TASK_OBJECTIVE_VARIANTS = [
  '... on TaskObjectiveItem { count foundInRaid items { id } }',
  '... on TaskObjectiveItem { count foundInRaid item { id } }',
];
const tasksQuery = obj => `query ($mode: GameMode) {
  tasks(gameMode: $mode, lang: ja) {
    id name kappaRequired lightkeeperRequired
    trader { name }
    objectives { type ${obj} }
  }
}`;

const HIDEOUT_QUERY = `query ($mode: GameMode) {
  hideoutStations(gameMode: $mode, lang: ja) {
    name
    levels { level itemRequirements { count item { id } } }
  }
}`;

async function buildMode(mode, enNames) {
  const [itemsData, tasksData, hideoutData] = await Promise.all([
    gql(ITEMS_QUERY, { mode }),
    firstWorking('tasks', TASK_OBJECTIVE_VARIANTS.map(v => () => gql(tasksQuery(v), { mode }))),
    gql(HIDEOUT_QUERY, { mode }).catch(e => {
      status.errors.push(`${mode} hideout: ${e.message.slice(0, 300)}`);
      return { hideoutStations: [] };
    }),
  ]);

  // タスク：手渡し(giveItem)と設置(plantItem)だけ数える。findItem は giveItem と重複するため除外
  const tasks = [];
  const taskUses = new Map(); // itemId -> [[taskIndex, count, fir]]
  for (const t of tasksData.tasks || []) {
    const idx = tasks.length;
    tasks.push({ n: t.name, tr: t.trader?.name || '', k: t.kappaRequired ? 1 : 0, lk: t.lightkeeperRequired ? 1 : 0 });
    for (const o of t.objectives || []) {
      if (!['giveItem', 'plantItem'].includes(o.type)) continue;
      const ids = o.items ? o.items.map(i => i.id) : o.item ? [o.item.id] : [];
      for (const id of ids) {
        if (!taskUses.has(id)) taskUses.set(id, []);
        taskUses.get(id).push([idx, o.count || 1, o.foundInRaid ? 1 : 0]);
      }
    }
  }

  // ハイドアウト：施設とレベルごとの必要アイテム
  const hideout = [];
  const hideoutUses = new Map(); // itemId -> [[hideoutIndex, count]]
  for (const st of hideoutData.hideoutStations || []) {
    for (const lv of st.levels || []) {
      const idx = hideout.length;
      hideout.push(`${st.name} Lv${lv.level}`);
      for (const r of lv.itemRequirements || []) {
        if (!r.item) continue;
        if (!hideoutUses.has(r.item.id)) hideoutUses.set(r.item.id, []);
        hideoutUses.get(r.item.id).push([idx, r.count || 1]);
      }
    }
  }

  const items = (itemsData.items || []).map(it => {
    const traders = (it.sellFor || []).filter(s => s.vendor && s.vendor.normalizedName !== 'flea-market');
    const best = traders.sort((a, b) => (b.priceRUB || 0) - (a.priceRUB || 0))[0];
    const row = {
      id: it.id,
      n: it.name,
      e: enNames.get(it.id) || '',
      s: it.shortName || '',
      i: (it.iconLink || '').replace(ICON_PREFIX, ''),
      f: it.lastLowPrice || 0,
      a: it.avg24hPrice || 0,
    };
    if ((it.types || []).includes('noFlea')) row.nf = 1;
    if (best) row.t = [best.vendor.name, best.priceRUB || 0];
    if (taskUses.has(it.id)) row.u = taskUses.get(it.id);
    if (hideoutUses.has(it.id)) row.h = hideoutUses.get(it.id);
    return row;
  });

  return { mode, updatedAt: new Date().toISOString(), iconPrefix: ICON_PREFIX, tasks, hideout, items };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const modes = await detectModes();
  status.detectedModes = modes;

  let enNames = new Map();
  try {
    const en = await gql('{ items(lang: en) { id name } }');
    enNames = new Map((en.items || []).map(i => [i.id, i.name]));
  } catch (e) {
    status.errors.push(`english names: ${e.message.slice(0, 300)}`);
  }

  for (const mode of modes) {
    try {
      const data = await buildMode(mode, enNames);
      fs.writeFileSync(`${OUT_DIR}/${mode}.json`, JSON.stringify(data));
      status.modes[mode] = { ok: true, items: data.items.length, tasks: data.tasks.length, updatedAt: data.updatedAt };
    } catch (e) {
      // 失敗したモードは前回のファイルを残す（消さない）
      status.modes[mode] = { ok: false, error: e.message.slice(0, 600) };
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
