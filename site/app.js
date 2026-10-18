// Tarkov Loot Checker の本体。
// 価格・タスクのデータは GitHub Actions が15分ごとに tarkov.dev から取ってきて、
// GitHub の data ブランチに置いている。このページはそのファイルを読んで、ブラウザの中で検索するだけ。

const DATA_BASE = 'https://raw.githubusercontent.com/lr0uv/tarkov-loot-checker/data/';
const MAX_RESULTS = 50;

let currentMode = 'regular';   // tarkov.dev では PvP を "regular" と呼ぶ
let seasonModeName = null;     // データにシーズン用のモードがあれば、その名前が入る
const dataByMode = {};         // 読み込んだデータを使い回すための入れ物

const $search = document.getElementById('search');
const $status = document.getElementById('status');
const $results = document.getElementById('results');
const $onlyNeeded = document.getElementById('onlyNeeded');
const $updated = document.getElementById('updated');

// ---- データの読み込み ----

async function fetchJson(name) {
  // ?t= を付けるのは、ブラウザが古いファイルを使い回さないようにするため（5分単位で変える）
  const res = await fetch(`${DATA_BASE}${name}?t=${Math.floor(Date.now() / 300000)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// どのモードのデータがあるかを status.json で確認し、シーズン用のモードがあればタブを有効にする
async function detectSeasonMode() {
  try {
    const st = await fetchJson('status.json');
    seasonModeName = Object.keys(st.modes || {}).find(m => m !== 'regular' && m !== 'pve' && st.modes[m].ok) || null;
    if (seasonModeName) {
      const btn = document.querySelector('.mode[data-mode="season"]');
      btn.disabled = false;
      btn.title = '';
      btn.textContent = 'シーズン';
    }
  } catch (e) {
    console.warn('status.json を読めませんでした', e);
  }
}

async function loadMode(mode) {
  if (!dataByMode[mode]) {
    dataByMode[mode] = fetchJson(`${mode}.json`).then(prepare).catch(e => {
      delete dataByMode[mode]; // 失敗したら次回やり直せるように消しておく
      throw e;
    });
  }
  return dataByMode[mode];
}

// 検索しやすいように、名前を「ひらがな・小文字・半角」にそろえたものを各アイテムに持たせておく
function prepare(data) {
  for (const it of data.items) it.key = normalize(`${it.n} ${it.e} ${it.s}`);
  return data;
}

function normalize(s) {
  return String(s).normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
    .replace(/[\s\-・.]/g, '');
}

// ---- 検索と表示 ----

async function runSearch() {
  const q = normalize($search.value.trim());
  const mode = currentMode === 'season' ? seasonModeName : currentMode;
  if (q.length < 2) {
    $results.innerHTML = '';
    $status.textContent = '2文字以上入力すると検索します。';
    return;
  }
  $status.textContent = 'データを読み込み中…';
  try {
    const data = await loadMode(mode);
    if (q !== normalize($search.value.trim())) return; // 待っている間に入力が変わっていたら捨てる
    $updated.textContent = `価格の更新: ${ago(data.updatedAt)}`;

    let list = data.items.filter(it => it.key.includes(q));
    if ($onlyNeeded.checked) list = list.filter(it => it.u || it.h);
    // 名前の先頭が一致するものを上に、そのあとは名前の短い順
    list.sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || a.n.length - b.n.length);
    const total = list.length;
    list = list.slice(0, MAX_RESULTS);

    $results.innerHTML = list.map(it => renderItem(it, data)).join('');
    $status.textContent = total === 0 ? '見つかりませんでした。'
      : total > MAX_RESULTS ? `${total}件中、上位${MAX_RESULTS}件を表示しています。`
      : `${total}件見つかりました。`;
  } catch (e) {
    $status.textContent = `データを取得できませんでした: ${e.message}`;
  }
}

function renderItem(it, data) {
  const uses = (it.u || []).map(([ti, count, fir]) => ({ ...data.tasks[ti], count, fir }));
  const hideout = (it.h || []).map(([hi, count]) => ({ name: data.hideout[hi], count }));

  const flea = it.nf
    ? '<span><span class="label">フリマ</span>出品不可</span>'
    : `<span><span class="label">フリマ最安</span><b>${rub(it.f)}</b></span>
       <span><span class="label">24時間平均</span><b>${rub(it.a)}</b></span>`;
  const trader = it.t
    ? `<span><span class="label">${esc(it.t[0])}に売却</span><b>${rub(it.t[1])}</b></span>`
    : '';
  const icon = it.i ? (it.i.startsWith('http') ? it.i : data.iconPrefix + it.i) : '';

  return `<li class="item">
    <img src="${esc(icon)}" alt="" loading="lazy">
    <div>
      <h2>${esc(it.n)}<small>${esc(it.s)}</small></h2>
      ${it.e && it.e !== it.n ? `<p class="en">${esc(it.e)}</p>` : ''}
      <div class="badges">${renderBadges(uses, hideout)}</div>
      <div class="prices">${flea}${trader}</div>
      ${renderList('使うタスク', uses.map(u =>
        `${esc(u.n)}（${esc(u.tr)}）×${u.count}${u.fir ? ' FIR' : ''}${u.k ? ' ・Kappa' : ''}`))}
      ${renderList('使うハイドアウト', hideout.map(h => `${esc(h.name)} ×${h.count}`))}
    </div>
  </li>`;
}

function renderBadges(uses, hideout) {
  if (!uses.length && !hideout.length) return '<span class="badge none">タスク・ハイドアウトでは不要</span>';
  const sum = list => list.reduce((n, x) => n + x.count, 0);
  const kappa = sum(uses.filter(u => u.k));
  const other = sum(uses) - kappa;
  let html = '';
  if (kappa) html += `<span class="badge kappa">Kappaに必要 ×${kappa}</span>`;
  if (other) html += `<span class="badge task">その他タスク ×${other}</span>`;
  if (uses.some(u => u.fir)) html += '<span class="badge task">FIR（レイド内で入手）が必要</span>';
  if (hideout.length) html += `<span class="badge hideout">ハイドアウト ×${sum(hideout)}</span>`;
  return html;
}

function renderList(title, rows) {
  if (!rows.length) return '';
  return `<details><summary>${title}（${rows.length}件）</summary><ul>${rows.map(r => `<li>${r}</li>`).join('')}</ul></details>`;
}

// ---- 小さな道具 ----

function rub(n) { return n ? `${Math.round(n).toLocaleString('ja-JP')} ₽` : '—'; }

function ago(iso) {
  if (!iso) return '不明';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min}分前`;
  if (min < 60 * 24) return `${Math.round(min / 60)}時間前`;
  return `${Math.round(min / 1440)}日前`;
}

// アイテム名などをそのままHTMLに入れると、悪意ある文字列で画面を壊されることがあるので無害化する
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 入力のたびに検索すると重いので、打ち終わって0.25秒たってから検索する
let timer;
$search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runSearch, 250); });
$onlyNeeded.addEventListener('change', runSearch);

document.querySelectorAll('.mode').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    currentMode = btn.dataset.mode;
    document.querySelectorAll('.mode').forEach(b => b.setAttribute('aria-selected', String(b === btn)));
    runSearch();
  });
});

detectSeasonMode();
loadMode('regular').catch(() => {}); // 最初のモードは先に読み込んでおき、検索を速くする
