// サーバーに置くファイル一式を dist/ に組み立てるスクリプト。GitHub Actions がアップロードの前に実行する。
//   1. site/ の検索ページ（index.html・app.js など）をそのままコピー
//   2. pages/ の読み物（ガイド・このサイトについて・プライバシーポリシーなど）に共通の枠を付けて書き出す
//   3. アイテムごとのページ（日本語・英語）とアイテム一覧を作る
//   4. PvEとPvPの価格差ランキングのページを作る
//   5. sitemap.xml・robots.txt・ads.txt を作る
// 手元で試すときは `node scripts/build-pages.mjs dist`。
//
// 価格は変わり続けるので、アイテムページには埋め込まず、開いたときに item.js が最新の値を読み込む。
// こうするとページ自体はほとんど変わらないので、毎回のアップロードが変わったファイルだけで済む。

import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'dist';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = 'https://tarkov-loot-checker.com';
const DATA_BASE = 'https://raw.githubusercontent.com/lr0uv/tarkov-loot-checker/data/';
const VERSION = 5; // CSS・JSを変えたら上げる（ブラウザに古いファイルを使わせないため）

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rub = n => (n ? `${Math.round(n).toLocaleString('en-US')}₽` : '—');

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// ---- 共通の枠（ヘッダー・フッター） ----

const UI = {
  ja: {
    search: '検索', progress: '進捗', guide: 'ガイド', support: '応援する', other: 'English', otherLang: 'en',
    about: 'このサイトについて', privacy: 'プライバシーポリシー', contact: 'お問い合わせ', items: 'アイテム一覧',
    data: '価格・タスク・ハイドアウトのデータ: <a href="https://tarkov.dev" target="_blank" rel="noopener">tarkov.dev</a>（5分ごとに自動更新）',
    fan: '本サイトは非公式のファンサイトで、Battlestate Games とは関係ありません。ゲーム内の名称・画像の権利は各権利者に帰属します。',
  },
  en: {
    search: 'Search', progress: 'Progress', guide: 'Guides', support: 'Support', other: '日本語', otherLang: 'ja',
    about: 'About', privacy: 'Privacy policy', contact: 'Contact', items: 'All items',
    data: 'Price, quest and hideout data: <a href="https://tarkov.dev" target="_blank" rel="noopener">tarkov.dev</a> (updated every 5 minutes)',
    fan: 'Unofficial fan site. Not affiliated with Battlestate Games. Game names and images belong to their respective owners.',
  },
};

// lang: 'ja' | 'en'、url: このページのパス（先頭の / なし）、alt: もう一方の言語のページのパス（なければ null）
function layout({ lang, url, alt, title, description, body, head = '', scripts = '' }) {
  const u = UI[lang];
  const base = lang === 'en' ? '/en/' : '/';
  const home = lang === 'en' ? '/?lang=en' : '/?lang=ja';
  const altLink = alt != null ? `/${alt}` : (lang === 'en' ? '/?lang=ja' : '/?lang=en');
  const hreflang = alt != null
    ? `<link rel="alternate" hreflang="${lang}" href="${SITE}/${url}">\n  <link rel="alternate" hreflang="${u.otherLang}" href="${SITE}/${alt}">`
    : '';
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#101211">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${SITE}/${url}">
  <link rel="canonical" href="${SITE}/${url}">
  ${hreflang}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/style.css?v=${VERSION}">
  ${head}
</head>
<body>
  <header class="top">
    <div class="wrap top-inner">
      <a class="logo" href="${home}" aria-label="Tarkov Loot Checker"><i class="mark" aria-hidden="true">T</i><b>Tarkov <span>Loot Checker</span></b></a>
      <nav class="nav">
        <a href="${home}">${u.search}</a>
        <a href="${home}#progress">${u.progress}</a>
        <a href="${base}guide/">${u.guide}</a>
      </nav>
      <div class="top-right">
        <a class="support" data-support hidden target="_blank" rel="noopener">${u.support}</a>
        <a class="lang" href="${altLink}" lang="${u.otherLang}">${u.other}</a>
      </div>
    </div>
  </header>
  <main class="wrap page">
${body}
  </main>
  <footer class="wrap footer">
    <nav class="footnav">
      <a href="${base}about.html">${u.about}</a>
      <a href="${base}privacy.html">${u.privacy}</a>
      <a href="${base}contact.html" data-contact>${u.contact}</a>
      <a href="${base}item/">${u.items}</a>
      <a data-support hidden target="_blank" rel="noopener">${u.support}</a>
    </nav>
    <p>${u.data}</p>
    <p>${u.fan}</p>
  </footer>
  <script src="/config.js?v=${VERSION}"></script>
  <script src="/common.js?v=${VERSION}"></script>
  <script>TLC.setupMonetization();</script>
  ${scripts}
</body>
</html>
`;
}

// ---- 1. 検索ページのファイルをコピー ----

function copySite() {
  for (const f of fs.readdirSync(path.join(ROOT, 'site'))) {
    fs.copyFileSync(path.join(ROOT, 'site', f), path.join(OUT, f));
  }
}

// ---- 2. 読み物ページ ----
// pages/ の各ファイルは、先頭に <!-- title: ... --> と <!-- description: ... --> を書き、その下に本文を書く。
// 英語版は pages/en/ に同じ名前で置くと、日本語版と相互にリンクされる。

const sitemap = [];

function buildPages() {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
  const pagesDir = path.join(ROOT, 'pages');
  for (const file of walk(pagesDir)) {
    const rel = path.relative(pagesDir, file).split(path.sep).join('/');
    const lang = rel.startsWith('en/') ? 'en' : 'ja';
    const src = fs.readFileSync(file, 'utf8');
    const meta = key => (src.match(new RegExp(`<!--\\s*${key}:\\s*(.*?)\\s*-->`)) || [])[1] || '';
    const body = src.replace(/<!--\s*(title|description):.*?-->\s*/g, '');
    const counterpart = lang === 'en' ? rel.slice(3) : `en/${rel}`;
    const hasAlt = fs.existsSync(path.join(pagesDir, counterpart));
    const url = rel.replace(/index\.html$/, '');
    write(rel, layout({
      lang, url, alt: hasAlt ? counterpart.replace(/index\.html$/, '') : null,
      title: `${meta('title')}｜Tarkov Loot Checker`.replace('｜', lang === 'en' ? ' | ' : '｜'),
      description: meta('description'), body,
    }));
    sitemap.push(url);
  }
}

// ---- 3. アイテムページ ----

const TEXT = {
  ja: {
    title: '{n}のフリマ価格・必要数（タスク・Kappa・ハイドアウト）',
    desc: '{n}（{e}）のフリマ価格、手数料を引いた手取り、トレーダー買取価格、1マスあたりの価値と、タスク・Kappa・ハイドアウトで必要な数。PvP・PvE対応、5分ごとに更新。',
    lead: '{n}の価格と、タスク・ハイドアウトで必要な数をまとめています。価格は開いた時点の最新の値です（5分ごとに更新）。',
    crumbs: '<a href="/?lang=ja">トップ</a> › <a href="/item/">アイテム一覧</a> › ',
    now: '現在の価格', loading: '読み込み中…',
    keepKappa: 'Kappa（コレクター）関連のタスクで必要です。売らずに保管するのがおすすめです。',
    keepTask: 'タスクで必要です。必要な数がそろうまでは、売らずに保管するのがおすすめです。',
    keepHide: 'ハイドアウトの拡張で必要です。必要な数がそろうまでは、保管するのがおすすめです。',
    sell: 'タスクやハイドアウトでは使いません。売ってお金にして問題ありません。',
    firNote: 'FIR（レイド内で入手した状態）が必要な納品があります。購入品は使えないので注意してください。',
    progressNote: '完了したタスクを記録すると、あと何個必要かが自動で計算されます。',
    openTool: '検索ページで開く（進捗を反映）',
    basics: '基本情報', name: '名前', short: '略称', en: '英語名', size: 'サイズ', slots: '{n}マス',
    fleaLv: 'フリマ出品', fleaLvV: 'プレイヤーレベル{n}から', noFlea: 'フリマに出品できません',
    tasks: '使うタスク', task: 'タスク', trader: 'トレーダー', count: '個数', hideout: '使うハイドアウト', station: '施設・レベル',
    total: '合計', desc2: 'アイテムの説明（ゲーム内）', related: '同じタスクで使うアイテム',
    yes: '必要', kappaCol: 'Kappa',
  },
  en: {
    title: '{e} flea price and how many you need (quests, Kappa, hideout)',
    desc: '{e} flea price, take-home after fees, trader price, value per slot, and how many you need for quests, Kappa and the hideout. PvP and PvE, updated every 5 minutes.',
    lead: 'Prices and quest / hideout requirements for {e}. Prices are loaded live when you open the page (updated every 5 minutes).',
    crumbs: '<a href="/?lang=en">Home</a> › <a href="/en/item/">All items</a> › ',
    now: 'Current prices', loading: 'Loading…',
    keepKappa: 'Needed for quests that lead to Kappa (The Collector). Keep it rather than selling.',
    keepTask: 'Needed for quests. Keep it until you have enough.',
    keepHide: 'Needed for hideout upgrades. Keep it until you have enough.',
    sell: 'Not used by any quest or hideout upgrade. Safe to sell.',
    firNote: 'Some hand-ins require it Found in Raid (FIR). Bought copies will not count.',
    progressNote: 'Track your finished quests and the site works out how many more you need.',
    openTool: 'Open in the search tool (with your progress)',
    basics: 'Details', name: 'Name', short: 'Short name', en: 'Japanese name', size: 'Size', slots: '{n} slots',
    fleaLv: 'Flea listing', fleaLvV: 'from player level {n}', noFlea: 'Cannot be listed on the flea',
    tasks: 'Quests that use it', task: 'Quest', trader: 'Trader', count: 'Count', hideout: 'Hideout upgrades that use it', station: 'Station / level',
    total: 'Total', desc2: 'In-game description', related: 'Other items for the same quests',
    yes: 'yes', kappaCol: 'Kappa',
  },
};
const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

function itemPage(it, data, lang, descriptions, relatedOf) {
  const T = TEXT[lang];
  const ja = lang === 'ja';
  const n = it.n, e = it.e || it.n;
  const main = ja ? n : e;
  const uses = (it.u || []).map(([ti, count, fir]) => ({ ...data.tasks[ti], count, fir }));
  const hide = (it.h || []).map(([hi, count, fir]) => ({ name: ja ? data.hideout[hi] : (data.hideoutEn?.[hi] || data.hideout[hi]), count, fir }));
  const kappa = uses.some(u => u.k), task = uses.length > 0, hideout = hide.length > 0;
  const anyFir = [...uses, ...hide].some(x => x.fir);
  const verdict = kappa ? T.keepKappa : task ? T.keepTask : hideout ? T.keepHide : T.sell;
  const icon = it.i ? (it.i.startsWith('http') ? it.i : data.iconPrefix + it.i) : '';
  const url = `${ja ? '' : 'en/'}item/${it.nn}.html`;
  const alt = `${ja ? 'en/' : ''}item/${it.nn}.html`;
  const sum = list => list.reduce((a, x) => a + x.count, 0);
  const description = descriptions[lang]?.[it.id];

  const rows = [
    [T.name, esc(main)], [T.short, esc(ja ? it.s : (it.se || it.s))], [T.en, esc(ja ? e : n)],
    [T.size, fmt(T.slots, { n: it.w || 1 })],
    [T.fleaLv, it.nf ? T.noFlea : it.ml ? fmt(T.fleaLvV, { n: it.ml }) : '—'],
  ];
  const related = relatedOf(it).slice(0, 12);

  const body = `
    <p class="crumbs">${T.crumbs}${esc(main)}</p>
    <div class="item-head">
      ${icon ? `<img src="${esc(icon)}" alt="${esc(main)}" width="72" height="72">` : ''}
      <div><h1>${esc(fmt(T.title, { n: main, e: main }))}</h1></div>
    </div>
    <p class="lead">${esc(fmt(T.lead, { n, e }))}</p>
    <div class="callout"><b>${esc(verdict)}</b>${anyFir ? `<br>${esc(T.firNote)}` : ''}${task || hideout ? `<br>${esc(T.progressNote)}` : ''}</div>

    <h2>${T.now}</h2>
    <div id="live" class="live" data-id="${esc(it.id)}" data-lang="${lang}"><div><span>${T.loading}</span><b>—</b></div></div>
    <p><a class="cta" href="/?lang=${lang}&q=${encodeURIComponent(ja ? n : e)}">${T.openTool}</a></p>

    ${uses.length ? `<h2>${T.tasks}</h2>
    <table><thead><tr><th>${T.task}</th><th>${T.trader}</th><th>${T.count}</th><th>FIR</th><th>${T.kappaCol}</th></tr></thead><tbody>
    ${uses.map(u => `<tr><td>${esc(ja ? u.n : (u.ne || u.n))}</td><td>${esc(ja ? u.tr : (u.tre || u.tr))}</td><td>${u.count}</td><td>${u.fir ? T.yes : '—'}</td><td>${u.k ? T.yes : '—'}</td></tr>`).join('')}
    <tr><th>${T.total}</th><td></td><td>${sum(uses)}</td><td></td><td></td></tr></tbody></table>` : ''}

    ${hide.length ? `<h2>${T.hideout}</h2>
    <table><thead><tr><th>${T.station}</th><th>${T.count}</th><th>FIR</th></tr></thead><tbody>
    ${hide.map(h => `<tr><td>${esc(h.name)}</td><td>${h.count}</td><td>${h.fir ? T.yes : '—'}</td></tr>`).join('')}
    <tr><th>${T.total}</th><td>${sum(hide)}</td><td></td></tr></tbody></table>` : ''}

    <h2>${T.basics}</h2>
    <table><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>

    ${description ? `<h2>${T.desc2}</h2><p>${esc(description)}</p>` : ''}

    ${related.length ? `<h2>${T.related}</h2><ul class="cards">${related.map(r =>
      `<li><a href="/${ja ? '' : 'en/'}item/${esc(r.nn)}.html">${esc(ja ? r.n : (r.e || r.n))}<small>${esc(ja ? r.e : r.n)}</small></a></li>`).join('')}</ul>` : ''}
  `;
  const structured = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: ja ? 'トップ' : 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: ja ? 'アイテム一覧' : 'All items', item: `${SITE}/${ja ? '' : 'en/'}item/` },
      { '@type': 'ListItem', position: 3, name: main, item: `${SITE}/${url}` },
    ],
  }).replace(/</g, '\\u003c')}</script>`;
  return {
    url,
    html: layout({
      lang, url, alt,
      title: `${fmt(T.title, { n: main, e: main })}${ja ? '｜' : ' | '}Tarkov Loot Checker`,
      description: fmt(T.desc, { n, e }),
      body, head: structured,
      scripts: `<script src="/item.js?v=${VERSION}"></script>`,
    }),
  };
}

function itemIndex(items, lang) {
  const ja = lang === 'ja';
  // 50音順・ABC順に並べ、タスクやハイドアウトで使うものに印を付ける
  const sorted = [...items].sort((a, b) => (ja ? a.n : (a.e || a.n)).localeCompare(ja ? b.n : (b.e || b.n), ja ? 'ja' : 'en'));
  const body = `
    <h1>${ja ? 'アイテム一覧' : 'All items'}</h1>
    <p class="lead">${ja
      ? `価格やタスクでの必要数を調べられるアイテムの一覧です（${sorted.length}件）。★はタスクかハイドアウトで使うアイテムです。`
      : `Every item with a price or a quest / hideout use (${sorted.length} items). ★ marks items used by quests or the hideout.`}</p>
    <ul class="cards">${sorted.map(it => `<li><a href="/${ja ? '' : 'en/'}item/${esc(it.nn)}.html">${it.u || it.h ? '★ ' : ''}${esc(ja ? it.n : (it.e || it.n))}<small>${esc(ja ? it.e : it.n)}</small></a></li>`).join('')}</ul>`;
  const url = `${ja ? '' : 'en/'}item/`;
  return layout({
    lang, url, alt: `${ja ? 'en/' : ''}item/`,
    title: ja ? 'アイテム一覧｜Tarkov Loot Checker' : 'All items | Tarkov Loot Checker',
    description: ja ? 'Escape from Tarkov のアイテム一覧。各アイテムのフリマ価格とタスク・ハイドアウトの必要数を確認できます。'
      : 'All Escape from Tarkov items with flea prices and quest / hideout requirements.',
    body,
  });
}

// ---- 4. PvEとPvPの価格差 ----
// 毎日作り直す読み物。同じアイテムでもモードによって相場が大きく違うことがあるので、その差が大きい順に並べる

function priceGapPage(pvp, pve, lang) {
  const ja = lang === 'ja';
  const pveById = new Map(pve.items.map(i => [i.id, i]));
  const rows = pvp.items
    .filter(i => i.f > 20000 && pveById.get(i.id)?.f > 20000 && i.nn)
    .map(i => ({ it: i, pvp: i.f, pve: pveById.get(i.id).f, ratio: pveById.get(i.id).f / i.f }));
  const top = (list, n) => list.slice(0, n).map(r => `<tr><td><a href="/${ja ? '' : 'en/'}item/${esc(r.it.nn)}.html">${esc(ja ? r.it.n : (r.it.e || r.it.n))}</a></td><td>${rub(r.pvp)}</td><td>${rub(r.pve)}</td><td>${r.ratio >= 1 ? '×' + r.ratio.toFixed(1) : '×' + r.ratio.toFixed(2)}</td></tr>`).join('');
  const head = ja ? '<tr><th>アイテム</th><th>PvP</th><th>PvE</th><th>PvE÷PvP</th></tr>' : '<tr><th>Item</th><th>PvP</th><th>PvE</th><th>PvE ÷ PvP</th></tr>';
  const higher = [...rows].sort((a, b) => b.ratio - a.ratio);
  const lower = [...rows].sort((a, b) => a.ratio - b.ratio);
  const date = new Date().toISOString().slice(0, 10);
  const body = ja ? `
    <p class="crumbs"><a href="/guide/">ガイド</a> › PvEとPvPの価格差</p>
    <h1>PvEとPvPで価格差が大きいアイテム</h1>
    <p class="lead">同じアイテムでも、PvEとPvPではフリマの相場が大きく違うことがあります。プレイ人数や、アイテムの集めやすさがモードごとに違うためです。このページはフリマの最安値をもとに毎日自動で作り直しています（${date}時点、2万₽以上のアイテムが対象）。</p>
    <h2>PvEのほうが高いアイテム</h2>
    <p>PvEで遊んでいるなら、PvPの感覚で安く売らないように注意したいアイテムです。</p>
    <table><thead>${head}</thead><tbody>${top(higher, 20)}</tbody></table>
    <h2>PvPのほうが高いアイテム</h2>
    <p>PvEでは値が付きにくいアイテムです。PvEではトレーダーに売るほうが得なこともあります。</p>
    <table><thead>${head}</thead><tbody>${top(lower, 20)}</tbody></table>
    <h2>使い方のヒント</h2>
    <p>検索ページの上にある「PvP / PvE」を切り替えると、そのモードの価格と手取りで判定が出ます。最後に選んだモードは次に開いたときも使われます。</p>
  ` : `
    <p class="crumbs"><a href="/en/guide/">Guides</a> › PvE vs PvP prices</p>
    <h1>Items with the biggest PvE vs PvP price gap</h1>
    <p class="lead">The same item can trade at very different prices in PvE and PvP, because player counts and how easy items are to find differ by mode. This page is rebuilt daily from the lowest flea prices (as of ${date}, items worth 20,000₽ or more).</p>
    <h2>More expensive in PvE</h2>
    <table><thead>${head}</thead><tbody>${top(higher, 20)}</tbody></table>
    <h2>More expensive in PvP</h2>
    <table><thead>${head}</thead><tbody>${top(lower, 20)}</tbody></table>
    <p>Switch between PvP and PvE at the top of the search page to see verdicts based on that mode's prices.</p>
  `;
  const url = `${ja ? '' : 'en/'}guide/pve-pvp-prices.html`;
  return { url, html: layout({
    lang, url, alt: `${ja ? 'en/' : ''}guide/pve-pvp-prices.html`,
    title: ja ? 'PvEとPvPで価格差が大きいアイテム（毎日更新）｜Tarkov Loot Checker' : 'Biggest PvE vs PvP price gaps (daily) | Tarkov Loot Checker',
    description: ja ? 'タルコフのPvEとPvPでフリマ価格の差が大きいアイテムのランキング。毎日自動更新。' : 'Escape from Tarkov items with the biggest flea price difference between PvE and PvP. Updated daily.',
    body,
  }) };
}

// ---- メイン ----

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  copySite();
  buildPages();

  // データが取れないときは失敗で止める（空のまま進むと、サーバーのアイテムページが消えてしまうため）
  const [pvp, pve] = await Promise.all([getJson(`${DATA_BASE}regular.json`), getJson(`${DATA_BASE}pve.json`)]);
  if (!pvp.items?.length || !pvp.items.some(i => i.nn)) throw new Error('regular.json にアイテムのURL名(nn)がありません');

  // ゲーム内の説明文（なくても続ける）
  const descriptions = { ja: {}, en: {} };
  for (const lang of ['ja', 'en']) {
    try {
      const dict = (await getJson(`https://json.tarkov.dev/regular/items_${lang}`)).data || {};
      for (const it of pvp.items) {
        const d = dict[`${it.id} description`];
        if (d) descriptions[lang][it.id] = d;
      }
    } catch (e) {
      console.warn(`説明文を取得できませんでした (${lang}): ${e.message}`);
    }
  }

  const items = pvp.items.filter(it => it.nn && (it.u || it.h || it.f));
  // 同じタスクで使うアイテム（関連リンク用）
  const byTask = new Map();
  for (const it of items) for (const [ti] of it.u || []) {
    if (!byTask.has(ti)) byTask.set(ti, []);
    byTask.get(ti).push(it);
  }
  const relatedOf = it => [...new Set((it.u || []).flatMap(([ti]) => byTask.get(ti) || []))].filter(x => x !== it);

  for (const lang of ['ja', 'en']) {
    for (const it of items) {
      const page = itemPage(it, pvp, lang, descriptions, relatedOf);
      write(page.url, page.html);
      sitemap.push(page.url);
    }
    write(`${lang === 'ja' ? '' : 'en/'}item/index.html`, itemIndex(items, lang));
    sitemap.push(`${lang === 'ja' ? '' : 'en/'}item/`);
    const gap = priceGapPage(pvp, pve, lang);
    write(gap.url, gap.html);
    sitemap.push(gap.url);
  }

  // 検索エンジン向けの地図（sitemap.xml）と案内（robots.txt）
  sitemap.unshift('');
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(sitemap)].map(u => `  <url><loc>${SITE}/${u}</loc></url>`).join('\n')}
</urlset>
`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  // AdSense のIDが config.js に入っていれば ads.txt を作る（広告の販売者を証明するファイル）
  const config = fs.readFileSync(path.join(ROOT, 'site', 'config.js'), 'utf8');
  const pub = (config.match(/adsenseClient:\s*'ca-(pub-\d+)'/) || [])[1];
  if (pub) write('ads.txt', `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);

  console.log(`pages: ${sitemap.length}, items: ${items.length}, descriptions: ja ${Object.keys(descriptions.ja).length} / en ${Object.keys(descriptions.en).length}, ads.txt: ${pub ? 'yes' : 'no'}`);
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
