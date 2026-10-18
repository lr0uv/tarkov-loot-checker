// Tarkov Loot Checker の本体。
// 価格・タスクのデータは GitHub Actions が5分ごとに tarkov.dev から取ってきて、
// GitHub の data ブランチに置いている。このページはそのファイルを読んで、ブラウザの中で検索するだけ。

const DATA_BASE = 'https://raw.githubusercontent.com/lr0uv/tarkov-loot-checker/data/';
const MAX_ROWS = 60;           // 一度に表示する最大件数（多すぎると画面が重くなるため）
const STALE_MINUTES = 30;      // データの取得がこれより古ければ、自動更新が止まっている可能性を知らせる
const TIER_HIGH = 40000;       // 1マスあたりこれ以上なら「高い」（金色）
const TIER_MID = 15000;        // これ以上なら「普通」

const state = { mode: 'regular', q: '', filter: 'all', sort: 'auto' };
const dataByMode = {};
let seasonAvailable = false;

const $ = id => document.getElementById(id);
const $q = $('q'), $list = $('list'), $meta = $('meta'), $more = $('more'), $notice = $('notice'), $sort = $('sort');

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
    it.key = normalize(`${it.n} ${it.e} ${it.s}`);
    it.slots = it.w || 1;

    const flea = it.nf ? 0 : it.f || 0;
    const trader = it.t ? it.t[1] : 0;
    it.sell = flea > trader
      ? { where: 'フリマ', price: flea, level: it.ml }
      : { where: it.t ? it.t[0] : '—', price: trader };
    it.per = Math.round(it.sell.price / it.slots);

    const uses = (it.u || []).map(([ti, count, fir]) => ({ ...data.tasks[ti], count, fir }));
    const hide = (it.h || []).map(([hi, count, fir]) => ({ name: data.hideout[hi], count, fir }));
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
    $meta.textContent = `データを取得できませんでした（${e.message}）。少し待ってから再読み込みしてください。`;
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

  const label = !q && state.filter === 'all' ? '1マスあたりの価値が高いアイテム'
    : !q ? `${filterName()}で必要なアイテム` : `「${state.q}」の検索結果`;
  $meta.textContent = total ? `${label}：${total}件` : `${label}：見つかりませんでした。略称や英語名でも検索できます。`;
  $more.hidden = total <= MAX_ROWS;
  $more.textContent = `上位${MAX_ROWS}件を表示しています。名前を入力すると絞り込めます。`;
}

function renderItem(it, data) {
  const icon = it.i ? (it.i.startsWith('http') ? it.i : data.iconPrefix + it.i) : '';
  const tier = it.per >= TIER_HIGH ? 'tier-high' : it.per >= TIER_MID ? 'tier-mid' : 'tier-low';
  const where = it.sell.price
    ? `${esc(it.sell.where)}${it.sell.level ? `（Lv${it.sell.level}〜）` : ''} ${rub(it.sell.price)}${it.slots > 1 ? `・${it.slots}マス` : ''}`
    : '売却不可';

  return `<li class="item">
    <div class="row">
      <img class="icon" src="${esc(icon)}" alt="" loading="lazy" width="52" height="52">
      <div class="name">
        <h2>${esc(it.n)}<small>${esc(it.s)}</small></h2>
        ${it.e && it.e !== it.n ? `<div class="sub">${esc(it.e)}</div>` : ''}
        ${renderVerdict(it)}
      </div>
      <div class="value">
        <div class="per ${tier}">${it.per ? rub(it.per) : '—'}<small>/マス</small></div>
        <div class="where">${where}</div>
      </div>
    </div>
    <details class="more-info"><summary>くわしく</summary><div class="info">${renderInfo(it)}</div></details>
  </li>`;
}

function renderVerdict(it) {
  const labels = { kappa: 'Kappa用に保管', task: 'タスク用に保管', hideout: 'ハイドアウト用に保管', sell: '売ってOK' };
  const needs = [];
  if (it.kappaN) needs.push(`Kappa ×${it.kappaN}`);
  if (it.taskN) needs.push(`タスク ×${it.taskN}`);
  if (it.hideN) needs.push(`ハイドアウト ×${it.hideN}`);
  const fir = it.fir === 'all' ? '（FIRのみ）' : it.fir === 'some' ? '（一部FIR）' : '';
  return `<span class="verdict ${it.verdict}">${labels[it.verdict]}${it.verdict !== 'sell' ? fir : ''}</span>`
    + (needs.length ? `<span class="needs">${needs.join('・')}</span>` : '');
}

function renderInfo(it) {
  const parts = [];
  if (it.uses.length) {
    parts.push(`<div><h3>使うタスク</h3><ul>${it.uses.map(u =>
      `<li>${u.k ? '<span class="k">[Kappa]</span> ' : ''}${esc(u.n)}（${esc(u.tr)}）×${u.count}${u.fir ? ' <span class="fir">FIR</span>' : ''}</li>`).join('')}</ul></div>`);
  }
  if (it.hide.length) {
    parts.push(`<div><h3>使うハイドアウト</h3><ul>${it.hide.map(h =>
      `<li>${esc(h.name)} ×${h.count}${h.fir ? ' <span class="fir">FIR</span>' : ''}</li>`).join('')}</ul></div>`);
  }
  parts.push(`<div><h3>価格</h3><div class="prices">
    <div><span>フリマ最安</span>${it.nf ? '出品不可' : rub(it.f)}</div>
    <div><span>24時間平均</span>${it.nf ? '—' : rub(it.a)}</div>
    ${it.t ? `<div><span>${esc(it.t[0])}</span>${rub(it.t[1])}</div>` : ''}
    ${it.ml && !it.nf ? `<div><span>フリマ出品</span>Lv${it.ml}から</div>` : ''}
  </div></div>`);
  return parts.join('');
}

// 価格の新しさを表示し、自動更新が止まっていそうなら警告を出す
function showFreshness(data) {
  const builtMin = minutesSince(data.builtAt || data.updatedAt);
  $notice.hidden = builtMin < STALE_MINUTES;
  $notice.textContent = `価格データの自動更新が止まっている可能性があります（最後の取得: ${ago(builtMin)}）。表示中の価格は古いかもしれません。`;
  $q.title = `フリマ価格の調査: ${ago(minutesSince(data.updatedAt))}`;
  $sort.parentElement.title = $q.title;
}

function filterName() {
  return { kappa: 'Kappa', task: 'タスク', hideout: 'ハイドアウト' }[state.filter] || '';
}

// ---- 状態の保存（URLと、最後に選んだモード） ----

function saveState() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.mode !== 'regular') p.set('m', state.mode);
  if (state.filter !== 'all') p.set('f', state.filter);
  if (state.sort !== 'auto') p.set('s', state.sort);
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

function rub(n) { return n ? `${Math.round(n).toLocaleString('ja-JP')}₽` : '—'; }
function minutesSince(iso) { return iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : Infinity; }
function ago(min) {
  if (!isFinite(min)) return '不明';
  if (min < 60) return `${min}分前`;
  if (min < 60 * 24) return `${Math.round(min / 60)}時間前`;
  return `${Math.round(min / 1440)}日前`;
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
  $meta.textContent = 'データを読み込み中…';
  render();
}));

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
  btn.title = seasonAvailable ? '' : 'シーズンのデータを取得できませんでした';
  if (state.mode === 'season' && !seasonAvailable) {
    state.mode = 'regular';
    syncButtons();
    render();
  }
}

restoreState();
syncButtons();
render();
detectSeason();
