// Tarkov Loot Checker の本体。
// 価格・タスクのデータは GitHub Actions が5分ごとに tarkov.dev から取ってきて、
// GitHub の data ブランチに置いている。このページはそのファイルを読んで、ブラウザの中で検索するだけ。

const DATA_BASE = 'https://raw.githubusercontent.com/lr0uv/tarkov-loot-checker/data/';
const MAX_ROWS = 60;           // 一度に表示する最大件数（多すぎると画面が重くなるため）
const STALE_MINUTES = 30;      // データの取得がこれより古ければ、自動更新が止まっている可能性を知らせる
const TIER_HIGH = 40000;       // 1マスあたりこれ以上なら「高い」（金色）
const TIER_MID = 15000;        // これ以上なら「普通」

const state = { mode: 'regular', q: '', filter: 'all', sort: 'auto', lang: 'ja' };
// ---- 表示する言葉（日本語と英語） ----
// 画面の文字はすべてここに集めて、言語ごとに切り替える。{x} の部分は後から値を入れる
const TEXT = {
  ja: {
    title: 'Tarkov Loot Checker｜タルコフのフリマ価格とKappa・タスク必要アイテム検索',
    desc: 'Escape from Tarkov のアイテムを名前で検索して、フリマ価格、1マスあたりの価値、Kappa・タスク・ハイドアウトで必要かどうかをすぐ確認できます。PvP・PvE・シーズン対応。',
    modesLabel: 'ゲームモード', season: 'シーズン',
    placeholder: 'アイテム名・略称で検索（例: グラフィック、gpu、ledx）',
    kbd: '/ キーでいつでも検索欄に移動',
    filtersLabel: '絞り込み', all: 'すべて', task: 'タスク', hideout: 'ハイドアウト',
    sortLabel: '並び順', sortAuto: 'おすすめ', sortSlot: '1マスの価値', sortPrice: '売値',
    loading: 'データを読み込み中…',
    footData: '価格・タスク・ハイドアウトのデータ: {src}（5分ごとに自動更新）',
    footFan: '本サイトは非公式のファンサイトで、Battlestate Games とは関係ありません。',
    loadError: 'データを取得できませんでした（{e}）。少し待ってから再読み込みしてください。',
    labelTop: '1マスあたりの価値が高いアイテム', labelNeeded: '{f}で必要なアイテム', labelSearch: '「{q}」の検索結果',
    count: '{label}：{n}件', none: '{label}：見つかりませんでした。略称や英語名でも検索できます。',
    more: '上位{n}件を表示しています。名前を入力すると絞り込めます。',
    flea: 'フリマ', fromLv: '（Lv{n}〜）', slots: '・{n}マス', perSlot: '/マス', unsellable: '売却不可',
    details: 'くわしく',
    vKappa: 'Kappa用に保管', vTask: 'タスク用に保管', vHideout: 'ハイドアウト用に保管', vSell: '売ってOK',
    firAll: '（FIRのみ）', firSome: '（一部FIR）', sep: '・',
    usedTasks: '使うタスク', usedHideout: '使うハイドアウト', prices: '価格',
    fleaLow: 'フリマ最安', avg24: '24時間平均', noFlea: '出品不可', fleaLevel: 'フリマ出品', lvFrom: 'Lv{n}から',
    stale: '価格データの自動更新が止まっている可能性があります（最後の取得: {ago}）。表示中の価格は古いかもしれません。',
    scanned: 'フリマ価格の調査: {ago}',
    unknown: '不明', minAgo: '{n}分前', hourAgo: '{n}時間前', dayAgo: '{n}日前',
    seasonMissing: 'シーズンのデータを取得できませんでした',
    langSwitch: 'English', langSwitchTitle: 'Switch to English',
  },
  en: {
    title: 'Tarkov Loot Checker | Flea prices and Kappa / quest item lookup for Escape from Tarkov',
    desc: 'Search any Escape from Tarkov item to see its flea price, value per slot, and whether you need it for Kappa, quests or the hideout. Supports PvP, PvE and seasonal wipes.',
    modesLabel: 'Game mode', season: 'Season',
    placeholder: 'Search by name or short name (e.g. gpu, ledx, bitcoin)',
    kbd: 'Press / to jump to search',
    filtersLabel: 'Filter', all: 'All', task: 'Quests', hideout: 'Hideout',
    sortLabel: 'Sort', sortAuto: 'Best match', sortSlot: 'Value per slot', sortPrice: 'Sell price',
    loading: 'Loading data…',
    footData: 'Price, quest and hideout data: {src} (updated every 5 minutes)',
    footFan: 'Unofficial fan site. Not affiliated with Battlestate Games.',
    loadError: 'Could not load data ({e}). Please wait a moment and reload.',
    labelTop: 'Most valuable items per slot', labelNeeded: 'Items needed for {f}', labelSearch: 'Results for "{q}"',
    count: '{label}: {n}', none: '{label}: nothing found. Try a short name or the Japanese name.',
    more: 'Showing the top {n}. Type a name to narrow it down.',
    flea: 'Flea', fromLv: ' (Lv{n}+)', slots: ' · {n} slots', perSlot: '/slot', unsellable: 'Cannot be sold',
    details: 'Details',
    vKappa: 'Keep for Kappa', vTask: 'Keep for quests', vHideout: 'Keep for hideout', vSell: 'Safe to sell',
    firAll: ' (FIR only)', firSome: ' (some FIR)', sep: ' · ',
    usedTasks: 'Quests', usedHideout: 'Hideout upgrades', prices: 'Prices',
    fleaLow: 'Flea lowest', avg24: '24h average', noFlea: 'Banned on flea', fleaLevel: 'Flea listing', lvFrom: 'from Lv{n}',
    stale: 'Price updates may have stopped (last fetched {ago}). Prices shown may be out of date.',
    scanned: 'Flea prices scanned {ago}',
    unknown: 'unknown', minAgo: '{n} min ago', hourAgo: '{n} h ago', dayAgo: '{n} days ago',
    seasonMissing: 'Season data is not available',
    langSwitch: '日本語', langSwitchTitle: '日本語に切り替える',
  },
};

// 言葉を取り出す。t('count', { n: 3 }) のように {n} を置き換えられる
function t(key, vars = {}) {
  const s = TEXT[state.lang][key] ?? TEXT.ja[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// 最初に使う言語を決める。URLの ?lang= → 前回選んだ言語 → ブラウザの言語設定 の順。
// ブラウザの言語が日本語なら日本語、それ以外は英語にする
function detectLang() {
  const p = new URLSearchParams(location.search).get('lang');
  if (p === 'ja' || p === 'en') return p;
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'ja' || saved === 'en') return saved;
  } catch {}
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  return String(langs[0] || '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

const dataByMode = {};
let seasonAvailable = false;

const $ = id => document.getElementById(id);
const $q = $('q'), $list = $('list'), $meta = $('meta'), $more = $('more'), $notice = $('notice'), $sort = $('sort'), $lang = $('lang');

// ---- データの読み込み ----

async function fetchJson(name) {
  // ?t= を付けるのは、ブラウザが古いファイルを使い回さないようにするため（5分単位で変える）
  const res = await fetch(`${DATA_BASE}${name}?t=${Math.floor(Date.now() / 300000)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function loadMode(mode) {
  if (!dataByMode[mode]) {
    dataByMode[mode] = fetchJson(`${mode}.json`).then(prepare).catch(e => {
      delete dataByMode[mode]; // 失敗したら次回やり直せるように消しておく
      throw e;
    });
  }
  return dataByMode[mode];
}

// 表示や並び替えに使う値を、読み込んだときに一度だけ計算しておく
function prepare(data) {
  for (const it of data.items) {
    it.key = normalize(`${it.n} ${it.e} ${it.s} ${it.se || ''}`);
    it.slots = it.w || 1;

    const flea = it.nf ? 0 : it.f || 0;
    const trader = it.t ? it.t[1] : 0;
    // where は日本語と英語の両方を持たせ、表示するときに選ぶ
    it.sell = flea > trader
      ? { flea: true, price: flea, level: it.ml }
      : { where: it.t ? [it.t[0], it.t[2] || it.t[0]] : ['—', '—'], price: trader };
    it.per = Math.round(it.sell.price / it.slots);

    const uses = (it.u || []).map(([ti, count, fir]) => ({ ...data.tasks[ti], count, fir }));
    const hide = (it.h || []).map(([hi, count, fir]) => ({ name: data.hideout[hi], ne: data.hideoutEn?.[hi] || data.hideout[hi], count, fir }));
    it.uses = uses;
    it.hide = hide;
    it.kappaN = sum(uses.filter(u => u.k));
    it.taskN = sum(uses) - it.kappaN;
    it.hideN = sum(hide);
    const needs = [...uses, ...hide];
    it.fir = !needs.length ? '' : needs.every(x => x.fir) ? 'all' : needs.some(x => x.fir) ? 'some' : '';
    it.verdict = it.kappaN ? 'kappa' : it.taskN ? 'task' : it.hideN ? 'hideout' : 'sell';
  }
  return data;
}

const sum = list => list.reduce((n, x) => n + x.count, 0);

function normalize(s) {
  return String(s).normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
    .replace(/[\s\-・.()（）]/g, '');
}

// ---- 検索と表示 ----

async function render() {
  saveState();
  let data;
  try {
    data = await loadMode(state.mode);
  } catch (e) {
    $meta.textContent = t('loadError', { e: e.message });
    $list.innerHTML = '';
    return;
  }
  showFreshness(data);

  const q = normalize(state.q);
  let list = data.items;
  if (q) list = list.filter(it => it.key.includes(q));
  if (state.filter === 'kappa') list = list.filter(it => it.kappaN);
  if (state.filter === 'task') list = list.filter(it => it.kappaN || it.taskN);
  if (state.filter === 'hideout') list = list.filter(it => it.hideN);
  if (!q && state.filter === 'all') list = list.filter(it => it.sell.price > 0);

  const bySlot = (a, b) => b.per - a.per;
  const byPrice = (a, b) => b.sell.price - a.sell.price;
  if (state.sort === 'price') list.sort(byPrice);
  else if (state.sort === 'slot' || !q) list.sort(bySlot);
  else list.sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || bySlot(a, b)); // 名前の先頭が一致するものを優先

  const total = list.length;
  $list.innerHTML = list.slice(0, MAX_ROWS).map(it => renderItem(it, data)).join('');

  const label = !q && state.filter === 'all' ? t('labelTop')
    : !q ? t('labelNeeded', { f: filterName() }) : t('labelSearch', { q: state.q });
  $meta.textContent = t(total ? 'count' : 'none', { label, n: total.toLocaleString() });
  $more.hidden = total <= MAX_ROWS;
  $more.textContent = t('more', { n: MAX_ROWS });
}

function renderItem(it, data) {
  const icon = it.i ? (it.i.startsWith('http') ? it.i : data.iconPrefix + it.i) : '';
  const tier = it.per >= TIER_HIGH ? 'tier-high' : it.per >= TIER_MID ? 'tier-mid' : 'tier-low';
  const en = state.lang === 'en';
  const place = it.sell.flea ? t('flea') : it.sell.where[en ? 1 : 0];
  const where = it.sell.price
    ? `${esc(place)}${it.sell.level ? t('fromLv', { n: it.sell.level }) : ''} ${rub(it.sell.price)}${it.slots > 1 ? t('slots', { n: it.slots }) : ''}`
    : t('unsellable');
  // 英語表示では英語名を大きく、日本語表示では日本語名を大きく出し、もう片方を小さく添える
  const main = en ? (it.e || it.n) : it.n;
  const other = en ? it.n : it.e;
  const short = en ? (it.se || it.s) : it.s;

  return `<li class="item">
    <div class="row">
      <img class="icon" src="${esc(icon)}" alt="" loading="lazy" width="52" height="52">
      <div class="name">
        <h2>${esc(main)}<small>${esc(short)}</small></h2>
        ${other && other !== main ? `<div class="sub" lang="${en ? 'ja' : 'en'}">${esc(other)}</div>` : ''}
        ${renderVerdict(it)}
      </div>
      <div class="value">
        <div class="per ${tier}">${it.per ? rub(it.per) : '—'}<small>${t('perSlot')}</small></div>
        <div class="where">${where}</div>
      </div>
    </div>
    <details class="more-info"><summary>${t('details')}</summary><div class="info">${renderInfo(it)}</div></details>
  </li>`;
}

function renderVerdict(it) {
  const labels = { kappa: t('vKappa'), task: t('vTask'), hideout: t('vHideout'), sell: t('vSell') };
  const needs = [];
  if (it.kappaN) needs.push(`Kappa ×${it.kappaN}`);
  if (it.taskN) needs.push(`${t('task')} ×${it.taskN}`);
  if (it.hideN) needs.push(`${t('hideout')} ×${it.hideN}`);
  const fir = it.fir === 'all' ? t('firAll') : it.fir === 'some' ? t('firSome') : '';
  return `<span class="verdict ${it.verdict}">${labels[it.verdict]}${it.verdict !== 'sell' ? fir : ''}</span>`
    + (needs.length ? `<span class="needs">${needs.join(t('sep'))}</span>` : '');
}

function renderInfo(it) {
  const en = state.lang === 'en';
  const parts = [];
  if (it.uses.length) {
    parts.push(`<div><h3>${t('usedTasks')}</h3><ul>${it.uses.map(u => {
      const trader = en ? (u.tre || u.tr) : u.tr;
      return `<li>${u.k ? '<span class="k">[Kappa]</span> ' : ''}${esc(en ? (u.ne || u.n) : u.n)}${trader ? (en ? ` (${esc(trader)})` : `（${esc(trader)}）`) : ''} ×${u.count}${u.fir ? ' <span class="fir">FIR</span>' : ''}</li>`;
    }).join('')}</ul></div>`);
  }
  if (it.hide.length) {
    parts.push(`<div><h3>${t('usedHideout')}</h3><ul>${it.hide.map(h =>
      `<li>${esc(en ? h.ne : h.name)} ×${h.count}${h.fir ? ' <span class="fir">FIR</span>' : ''}</li>`).join('')}</ul></div>`);
  }
  parts.push(`<div><h3>${t('prices')}</h3><div class="prices">
    <div><span>${t('fleaLow')}</span>${it.nf ? t('noFlea') : rub(it.f)}</div>
    <div><span>${t('avg24')}</span>${it.nf ? '—' : rub(it.a)}</div>
    ${it.t ? `<div><span>${esc(en ? (it.t[2] || it.t[0]) : it.t[0])}</span>${rub(it.t[1])}</div>` : ''}
    ${it.ml && !it.nf ? `<div><span>${t('fleaLevel')}</span>${t('lvFrom', { n: it.ml })}</div>` : ''}
  </div></div>`);
  return parts.join('');
}

// 価格の新しさを表示し、自動更新が止まっていそうなら警告を出す
function showFreshness(data) {
  const builtMin = minutesSince(data.builtAt || data.updatedAt);
  $notice.hidden = builtMin < STALE_MINUTES;
  $notice.textContent = t('stale', { ago: ago(builtMin) });
  $q.title = t('scanned', { ago: ago(minutesSince(data.updatedAt)) });
  $sort.parentElement.title = $q.title;
}

function filterName() {
  return { kappa: 'Kappa', task: t('task'), hideout: t('hideout') }[state.filter] || '';
}

// ---- 状態の保存（URLと、最後に選んだモード） ----

function saveState() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.mode !== 'regular') p.set('m', state.mode);
  if (state.filter !== 'all') p.set('f', state.filter);
  if (state.sort !== 'auto') p.set('s', state.sort);
  if (new URLSearchParams(location.search).has('lang')) p.set('lang', state.lang); // 共有されたURLの言語指定は残す
  history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
  try { localStorage.setItem('mode', state.mode); } catch {}
}

function restoreState() {
  const p = new URLSearchParams(location.search);
  let saved = null;
  try { saved = localStorage.getItem('mode'); } catch {}
  state.mode = p.get('m') || saved || 'regular';
  state.q = p.get('q') || '';
  state.filter = p.get('f') || 'all';
  state.sort = p.get('s') || 'auto';
  $q.value = state.q;
  $sort.value = state.sort;
}

function syncButtons() {
  document.querySelectorAll('.mode').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
  document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
}

// ---- 小さな道具 ----

function rub(n) { return n ? `${Math.round(n).toLocaleString('en-US')}₽` : '—'; }
function minutesSince(iso) { return iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : Infinity; }
function ago(min) {
  if (!isFinite(min)) return t('unknown');
  if (min < 60) return t('minAgo', { n: min });
  if (min < 60 * 24) return t('hourAgo', { n: Math.round(min / 60) });
  return t('dayAgo', { n: Math.round(min / 1440) });
}

// アイテム名などをそのままHTMLに入れると、悪意ある文字列で画面を壊されることがあるので無害化する
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- 操作 ----

let timer;
$q.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => { state.q = $q.value.trim(); render(); }, 80);
});
$sort.addEventListener('change', () => { state.sort = $sort.value; render(); });

document.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
  state.filter = btn.dataset.filter;
  syncButtons();
  render();
}));

document.querySelectorAll('.mode').forEach(btn => btn.addEventListener('click', () => {
  if (btn.disabled) return;
  state.mode = btn.dataset.mode;
  syncButtons();
  $meta.textContent = t('loading');
  render();
}));

// 言語の切り替えボタン。選んだ言語は覚えておき、次に開いたときもその言語で表示する
$lang.addEventListener('click', () => {
  state.lang = state.lang === 'ja' ? 'en' : 'ja';
  try { localStorage.setItem('lang', state.lang); } catch {}
  applyLang();
  render();
});

// HTMLに直接書いてある文字（data-i18n の付いた要素）を、今の言語に書き換える
function applyLang() {
  document.documentElement.lang = state.lang;
  document.title = t('title');
  document.querySelector('meta[name="description"]').content = t('desc');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, t(key));
    }
  });
  $lang.textContent = t('langSwitch');
  $lang.title = t('langSwitchTitle');
  $lang.lang = state.lang === 'ja' ? 'en' : 'ja';
  const src = 'tarkov.dev';
  $('foot-data').innerHTML = esc(t('footData', { src: '\u0000' })).replace('\u0000', `<a href="https://tarkov.dev" target="_blank" rel="noopener">${src}</a>`);
  updateSeasonTitle();
}

// 「/」でいつでも検索欄へ、「Esc」で入力を消す
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== $q) {
    e.preventDefault();
    $q.focus();
    $q.select();
  } else if (e.key === 'Escape' && document.activeElement === $q) {
    $q.value = '';
    state.q = '';
    render();
  }
});

// どのモードのデータがあるかを status.json で確認し、シーズンのタブを有効にする
async function detectSeason() {
  try {
    const st = await fetchJson('status.json');
    seasonAvailable = !!st.modes?.season?.ok;
  } catch {}
  const btn = document.querySelector('.mode[data-mode="season"]');
  btn.disabled = !seasonAvailable;
  updateSeasonTitle();
  if (state.mode === 'season' && !seasonAvailable) {
    state.mode = 'regular';
    syncButtons();
    render();
  }
}

function updateSeasonTitle() {
  const btn = document.querySelector('.mode[data-mode="season"]');
  btn.title = btn.disabled ? t('seasonMissing') : '';
}

state.lang = detectLang();
applyLang();
restoreState();
syncButtons();
render();
detectSeason();
