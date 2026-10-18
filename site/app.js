// Tarkov Loot Checker の検索ページ。
// 価格・タスクのデータは GitHub Actions が5分ごとに tarkov.dev から取ってきて、
// GitHub の data ブランチに置いている。このページはそのファイルを読んで、ブラウザの中で検索するだけ。
// 共通の道具（データ読み込み・手数料・進捗の保存など）は common.js の TLC にある。

const MAX_ROWS = 60;           // 一度に表示する最大件数（多すぎると画面が重くなるため）
const STALE_MINUTES = 30;      // データの取得がこれより古ければ、自動更新が止まっている可能性を知らせる
const TIER_HIGH = 40000;       // 1マスあたりこれ以上なら「高い」（金色）
const TIER_MID = 15000;        // これ以上なら「普通」

const { esc, rub, normalize } = TLC;
const state = { mode: 'regular', q: '', filter: 'all', sort: 'auto', lang: 'ja', view: 'search', ptab: 'tasks', pq: '', cascade: true, onlyItems: true };
let progress = TLC.loadProgress('regular');
let seasonAvailable = false;

// ---- 表示する言葉（日本語と英語） ----
// 画面の文字はすべてここに集めて、言語ごとに切り替える。{x} の部分は後から値を入れる
const TEXT = {
  ja: {
    title: 'Tarkov Loot Checker｜タルコフのフリマ価格とKappa・タスク必要アイテム検索',
    desc: 'Escape from Tarkov のアイテムを名前で検索して、フリマ価格、手数料を引いた手取り、1マスあたりの価値、Kappa・タスク・ハイドアウトであと何個必要かをすぐ確認できます。進捗管理つき。PvP・PvE・シーズン対応。',
    modesLabel: 'ゲームモード', season: 'シーズン',
    navSearch: '検索', navProgress: '進捗', navGuide: 'ガイド', support: '応援する',
    placeholder: 'アイテム名・略称で検索（例: グラボ、gpu、ledx）',
    kbd: '/ キーでいつでも検索欄に移動',
    filtersLabel: '絞り込み', all: 'すべて', task: 'タスク', hideout: 'ハイドアウト',
    sortLabel: '並び順', sortAuto: 'おすすめ', sortSlot: '1マスの価値', sortPrice: '売値',
    loading: 'データを読み込み中…',
    footData: '価格・タスク・ハイドアウトのデータ: {src}（5分ごとに自動更新）',
    footFan: '本サイトは非公式のファンサイトで、Battlestate Games とは関係ありません。',
    footAbout: 'このサイトについて', footPrivacy: 'プライバシーポリシー', footContact: 'お問い合わせ',
    loadError: 'データを取得できませんでした（{e}）。少し待ってから再読み込みしてください。',
    labelTop: '1マスあたりの価値が高いアイテム', labelNeeded: '{f}で必要なアイテム', labelSearch: '「{q}」の検索結果',
    count: '{label}：{n}件', none: '{label}：見つかりませんでした。略称や英語名でも検索できます。',
    more: '上位{n}件を表示しています。名前を入力すると絞り込めます。',
    flea: 'フリマ', fromLv: '（Lv{n}〜）', slots: '・{n}マス', perSlot: '/マス', unsellable: '売却不可',
    netAfterFee: '手取り {n}', details: 'くわしく',
    vKappa: 'Kappa用に保管', vTask: 'タスク用に保管', vHideout: 'ハイドアウト用に保管', vSell: '売ってOK',
    vEnough: '必要数そろった・余りは売ってOK', vDone: '使う予定なし（完了済み）・売ってOK',
    left: 'あと{n}個', firAll: '（FIRのみ）', firSome: '（一部FIR）', sep: '・',
    usedTasks: '使うタスク', usedHideout: '使うハイドアウト', prices: '価格', doneMark: '完了',
    fleaLow: 'フリマ最安', avg24: '24時間平均', fee: 'フリマ手数料（目安）', net: 'フリマ手取り',
    change48: '48時間の値動き', noFlea: '出品不可', fleaLevel: 'フリマ出品', lvFrom: 'Lv{n}から',
    owned: '持っている数', ownedHint: '集めた数を記録すると「あと何個」が減ります（{m}・このブラウザに保存）',
    itemPage: 'このアイテムのページ',
    kappaBar: 'Kappa用アイテム：そろった {a} / {b} 種類',
    stale: '価格データの自動更新が止まっている可能性があります（最後の取得: {ago}）。表示中の価格は古いかもしれません。',
    scanned: 'フリマ価格の調査: {ago}',
    unknown: '不明', minAgo: '{n}分前', hourAgo: '{n}時間前', dayAgo: '{n}日前',
    seasonMissing: 'シーズンのデータを取得できませんでした',
    langSwitch: 'English', langSwitchTitle: 'Switch to English',
    // 進捗ページ
    pTitle: '進捗管理',
    pIntro: '完了したタスクやハイドアウトを記録すると、もう必要ないアイテムが「売ってOK」に変わり、「あと何個必要か」が表示されます。記録はこのブラウザの中だけに保存され、PvP・PvE・シーズンで別々です（今は{m}）。',
    pTasks: 'タスク', pHideout: 'ハイドアウト', pTransfer: '引き継ぎ',
    pStatTasks: 'タスク完了', pStatKappa: 'Kappa必要タスク', pStatHideout: 'ハイドアウト',
    pFilter: 'タスク名・トレーダーで絞り込み', pCascade: '前提タスクもまとめて完了にする', pOnlyItems: 'アイテムが必要なタスクだけ表示',
    pLevel: 'Lv{n}', pNoTasks: '該当するタスクはありません。', pStation: '現在のレベル',
    pCopy: '進捗コードをコピー', pCopied: 'コピーしました。別の端末で「読み込む」に貼り付けてください。',
    pPaste: '進捗コードを貼り付け', pLoad: '読み込む', pLoaded: '読み込みました。', pBad: 'コードを読み取れませんでした。',
    pReset: 'このモードの進捗をすべて消す', pResetConfirm: '{m}の進捗（完了タスク・ハイドアウト・持っている数）をすべて消します。よろしいですか？',
    pTransferHelp: 'PCとスマホなど、別の端末に進捗を移すときに使います。コードには進捗だけが入っていて、個人情報は含まれません。',
    modeName: { regular: 'PvP', pve: 'PvE', season: 'シーズン' },
  },
  en: {
    title: 'Tarkov Loot Checker | Flea prices and Kappa / quest item lookup for Escape from Tarkov',
    desc: 'Search any Escape from Tarkov item to see its flea price, take-home after fees, value per slot, and how many more you need for Kappa, quests or the hideout. With progress tracking. Supports PvP, PvE and seasonal wipes.',
    modesLabel: 'Game mode', season: 'Season',
    navSearch: 'Search', navProgress: 'Progress', navGuide: 'Guides', support: 'Support',
    placeholder: 'Search by name or short name (e.g. gpu, ledx, bitcoin)',
    kbd: 'Press / to jump to search',
    filtersLabel: 'Filter', all: 'All', task: 'Quests', hideout: 'Hideout',
    sortLabel: 'Sort', sortAuto: 'Best match', sortSlot: 'Value per slot', sortPrice: 'Sell price',
    loading: 'Loading data…',
    footData: 'Price, quest and hideout data: {src} (updated every 5 minutes)',
    footFan: 'Unofficial fan site. Not affiliated with Battlestate Games.',
    footAbout: 'About', footPrivacy: 'Privacy policy', footContact: 'Contact',
    loadError: 'Could not load data ({e}). Please wait a moment and reload.',
    labelTop: 'Most valuable items per slot', labelNeeded: 'Items needed for {f}', labelSearch: 'Results for "{q}"',
    count: '{label}: {n}', none: '{label}: nothing found. Try a short name or the Japanese name.',
    more: 'Showing the top {n}. Type a name to narrow it down.',
    flea: 'Flea', fromLv: ' (Lv{n}+)', slots: ' · {n} slots', perSlot: '/slot', unsellable: 'Cannot be sold',
    netAfterFee: 'take-home {n}', details: 'Details',
    vKappa: 'Keep for Kappa', vTask: 'Keep for quests', vHideout: 'Keep for hideout', vSell: 'Safe to sell',
    vEnough: 'You have enough · sell extras', vDone: 'No longer needed · safe to sell',
    left: '{n} more', firAll: ' (FIR only)', firSome: ' (some FIR)', sep: ' · ',
    usedTasks: 'Quests', usedHideout: 'Hideout upgrades', prices: 'Prices', doneMark: 'done',
    fleaLow: 'Flea lowest', avg24: '24h average', fee: 'Flea fee (est.)', net: 'Flea take-home',
    change48: '48h change', noFlea: 'Banned on flea', fleaLevel: 'Flea listing', lvFrom: 'from Lv{n}',
    owned: 'You have', ownedHint: 'Recording what you have lowers the "more" count ({m}, saved in this browser)',
    itemPage: 'Item page',
    kappaBar: 'Kappa items: {a} / {b} collected',
    stale: 'Price updates may have stopped (last fetched {ago}). Prices shown may be out of date.',
    scanned: 'Flea prices scanned {ago}',
    unknown: 'unknown', minAgo: '{n} min ago', hourAgo: '{n} h ago', dayAgo: '{n} days ago',
    seasonMissing: 'Season data is not available',
    langSwitch: '日本語', langSwitchTitle: '日本語に切り替える',
    pTitle: 'Progress',
    pIntro: 'Tick the quests and hideout levels you have finished. Items you no longer need switch to "safe to sell" and every item shows how many more you need. Progress is saved only in this browser, separately for PvP, PvE and Season (now: {m}).',
    pTasks: 'Quests', pHideout: 'Hideout', pTransfer: 'Transfer',
    pStatTasks: 'Quests done', pStatKappa: 'Kappa quests', pStatHideout: 'Hideout',
    pFilter: 'Filter by quest or trader', pCascade: 'Also complete prerequisite quests', pOnlyItems: 'Only quests that need items',
    pLevel: 'Lv{n}', pNoTasks: 'No matching quests.', pStation: 'Current level',
    pCopy: 'Copy progress code', pCopied: 'Copied. Paste it into "Load" on your other device.',
    pPaste: 'Paste a progress code', pLoad: 'Load', pLoaded: 'Loaded.', pBad: 'Could not read that code.',
    pReset: 'Clear all progress for this mode', pResetConfirm: 'This clears all {m} progress (quests, hideout and items you have). Continue?',
    pTransferHelp: 'Use this to move your progress to another device. The code holds only your progress, no personal information.',
    modeName: { regular: 'PvP', pve: 'PvE', season: 'Season' },
  },
};

function t(key, vars = {}) {
  const s = TEXT[state.lang][key] ?? TEXT.ja[key] ?? key;
  return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s;
}
const modeName = () => t('modeName')[state.mode];
const en = () => state.lang === 'en';

const $ = id => document.getElementById(id);
const $q = $('q'), $list = $('list'), $meta = $('meta'), $more = $('more'), $notice = $('notice'), $sort = $('sort'), $lang = $('lang');
const $kbar = $('kappa-bar'), $progress = $('view-progress'), $search = $('view-search');

// ---- 検索と表示 ----

async function render() {
  saveState();
  let data;
  try {
    data = await TLC.loadMode(state.mode);
  } catch (e) {
    $meta.textContent = t('loadError', { e: e.message });
    $list.innerHTML = '';
    return;
  }
  showFreshness(data);
  if (state.view === 'progress') return renderProgress(data);

  const q = normalize(state.q);
  // 進捗によって必要数が変わるので、表示のたびに計算する
  let list = data.items.map(it => ({ it, nd: TLC.needs(it, progress), sell: TLC.bestSell(it) }));
  for (const x of list) x.per = Math.round(x.sell.net / x.it.slots);
  if (q) list = list.filter(x => x.it.key.includes(q));
  if (state.filter === 'kappa') list = list.filter(x => x.nd.kappaN);
  if (state.filter === 'task') list = list.filter(x => x.nd.kappaN || x.nd.taskN);
  if (state.filter === 'hideout') list = list.filter(x => x.nd.hideN);
  if (!q && state.filter === 'all') list = list.filter(x => x.sell.price > 0);

  const bySlot = (a, b) => b.per - a.per;
  const byPrice = (a, b) => b.sell.net - a.sell.net;
  // 「あと何個」が残っているものを上に出す（そろったものは下へ）
  const byLeft = (a, b) => (!!b.nd.left - !!a.nd.left);
  if (state.sort === 'price') list.sort(byPrice);
  else if (state.sort === 'slot') list.sort(bySlot);
  else if (!q) list.sort((a, b) => (state.filter !== 'all' && byLeft(a, b)) || bySlot(a, b));
  else list.sort((a, b) => (b.it.key.startsWith(q) - a.it.key.startsWith(q)) || bySlot(a, b)); // 名前の先頭が一致するものを優先

  renderKappaBar(data);
  const total = list.length;
  $list.innerHTML = list.slice(0, MAX_ROWS).map(x => renderItem(x, data)).join('');

  const label = !q && state.filter === 'all' ? t('labelTop')
    : !q ? t('labelNeeded', { f: filterName() }) : t('labelSearch', { q: state.q });
  $meta.textContent = t(total ? 'count' : 'none', { label, n: total.toLocaleString() });
  $more.hidden = total <= MAX_ROWS;
  $more.textContent = t('more', { n: MAX_ROWS });
}

function renderKappaBar(data) {
  $kbar.hidden = state.filter !== 'kappa';
  if ($kbar.hidden) return;
  // Kappa用のアイテムのうち、必要数がそろった（またはそのタスクを完了した）種類の数
  const kappaItems = data.items.filter(it => it.uses.some(u => u.k));
  const done = kappaItems.filter(it => {
    const nd = TLC.needs(it, progress);
    return !nd.left || !it.uses.some(u => u.k && !progress.t.has(u.id));
  }).length;
  const pct = kappaItems.length ? Math.round(done / kappaItems.length * 100) : 0;
  $kbar.innerHTML = `<div class="bar-label">${esc(t('kappaBar', { a: done, b: kappaItems.length }))}<span>${pct}%</span></div><div class="bar"><i style="width:${pct}%"></i></div>`;
}

function itemUrl(it) {
  return it.nn ? `${en() ? 'en/' : ''}item/${encodeURIComponent(it.nn)}.html` : '';
}

function renderItem({ it, nd, sell, per }, data) {
  const icon = it.i ? (it.i.startsWith('http') ? it.i : data.iconPrefix + it.i) : '';
  const tier = per >= TIER_HIGH ? 'tier-high' : per >= TIER_MID ? 'tier-mid' : 'tier-low';
  const place = sell.flea ? t('flea') : sell.where[en() ? 1 : 0];
  const where = sell.price
    ? `${esc(place)}${sell.level ? t('fromLv', { n: sell.level }) : ''} ${rub(sell.price)}${it.slots > 1 ? t('slots', { n: it.slots }) : ''}`
    : t('unsellable');
  // 英語表示では英語名を大きく、日本語表示では日本語名を大きく出し、もう片方を小さく添える
  const main = en() ? (it.e || it.n) : it.n;
  const other = en() ? it.n : it.e;
  const short = en() ? (it.se || it.s) : it.s;

  return `<li class="item" data-id="${esc(it.id)}">
    <div class="row">
      <img class="icon" src="${esc(icon)}" alt="" loading="lazy" width="52" height="52">
      <div class="name">
        <h2>${esc(main)}<small>${esc(short)}</small></h2>
        ${other && other !== main ? `<div class="sub" lang="${en() ? 'ja' : 'en'}">${esc(other)}</div>` : ''}
        ${renderVerdict(nd)}
      </div>
      <div class="value">
        <div class="per ${tier}">${per ? rub(per) : '—'}<small>${t('perSlot')}</small></div>
        <div class="where">${where}</div>
        ${sell.flea && sell.fee ? `<div class="where">${t('netAfterFee', { n: rub(sell.net) })}</div>` : ''}
      </div>
    </div>
    <details class="more-info"><summary>${t('details')}</summary><div class="info">${renderInfo(it, nd)}</div></details>
  </li>`;
}

function renderVerdict(nd) {
  const labels = { kappa: t('vKappa'), task: t('vTask'), hideout: t('vHideout'), sell: t('vSell'), enough: t('vEnough'), done: t('vDone') };
  const keep = ['kappa', 'task', 'hideout'].includes(nd.verdict);
  const needs = [];
  if (keep) {
    if (nd.kappaN) needs.push(`Kappa ×${nd.kappaN}`);
    if (nd.taskN) needs.push(`${t('task')} ×${nd.taskN}`);
    if (nd.hideN) needs.push(`${t('hideout')} ×${nd.hideN}`);
    if (nd.owned) needs.push(t('left', { n: nd.left }));
  }
  const fir = nd.fir === 'all' ? t('firAll') : nd.fir === 'some' ? t('firSome') : '';
  const cls = keep ? nd.verdict : nd.verdict === 'sell' ? 'sell' : 'enough';
  return `<span class="verdict ${cls}">${labels[nd.verdict]}${keep ? fir : ''}</span>`
    + (needs.length ? `<span class="needs">${needs.join(t('sep'))}</span>` : '');
}

function renderInfo(it, nd) {
  const parts = [];
  if (nd.uses.length) {
    parts.push(`<div><h3>${t('usedTasks')}</h3><ul>${nd.uses.map(u => {
      const trader = en() ? (u.tre || u.tr) : u.tr;
      return `<li class="${u.done ? 'done' : ''}">${u.k ? '<span class="k">[Kappa]</span> ' : ''}${esc(en() ? (u.ne || u.n) : u.n)}${trader ? (en() ? ` (${esc(trader)})` : `（${esc(trader)}）`) : ''} ×${u.count}${u.fir ? ' <span class="fir">FIR</span>' : ''}${u.done ? ` <span class="ok">${t('doneMark')}</span>` : ''}</li>`;
    }).join('')}</ul></div>`);
  }
  if (nd.hide.length) {
    parts.push(`<div><h3>${t('usedHideout')}</h3><ul>${nd.hide.map(h =>
      `<li class="${h.done ? 'done' : ''}">${esc(en() ? h.ne : h.name)} ×${h.count}${h.fir ? ' <span class="fir">FIR</span>' : ''}${h.done ? ` <span class="ok">${t('doneMark')}</span>` : ''}</li>`).join('')}</ul></div>`);
  }
  if (nd.total || nd.owned) {
    parts.push(`<div class="owned"><h3>${t('owned')}</h3>
      <div class="stepper"><button type="button" data-own="-1" aria-label="-1">−</button><b>${nd.owned}</b><button type="button" data-own="1" aria-label="+1">＋</button></div>
      <p class="hint">${esc(t('ownedHint', { m: modeName() }))}</p></div>`);
  }
  const fee = !it.nf && it.f && it.bp ? TLC.fleaFee(it.bp, it.f) : 0;
  parts.push(`<div><h3>${t('prices')}</h3><div class="prices">
    <div><span>${t('fleaLow')}</span>${it.nf ? t('noFlea') : rub(it.f)}</div>
    <div><span>${t('avg24')}</span>${it.nf ? '—' : rub(it.a)}</div>
    ${fee ? `<div><span>${t('fee')}</span>${rub(fee)}</div><div><span>${t('net')}</span>${rub(Math.max(0, it.f - fee))}</div>` : ''}
    ${it.t ? `<div><span>${esc(en() ? (it.t[2] || it.t[0]) : it.t[0])}</span>${rub(it.t[1])}</div>` : ''}
    ${it.c ? `<div><span>${t('change48')}</span><em class="${it.c > 0 ? 'up' : 'down'}">${it.c > 0 ? '+' : ''}${it.c}%</em></div>` : ''}
    ${it.ml && !it.nf ? `<div><span>${t('fleaLevel')}</span>${t('lvFrom', { n: it.ml })}</div>` : ''}
  </div></div>`);
  const url = itemUrl(it);
  if (url) parts.push(`<div><a href="${esc(url)}">${t('itemPage')} →</a></div>`);
  return parts.join('');
}

// 「持っている数」の＋−ボタン。開いている「くわしく」を閉じずに、その行だけ書き換える
$list.addEventListener('click', async e => {
  const btn = e.target.closest('[data-own]');
  if (!btn) return;
  const li = btn.closest('.item');
  const id = li.dataset.id;
  const n = Math.max(0, (Number(progress.o[id]) || 0) + Number(btn.dataset.own));
  if (n) progress.o[id] = n; else delete progress.o[id];
  TLC.saveProgress(state.mode, progress);
  const data = await TLC.loadMode(state.mode);
  const it = data.items.find(x => x.id === id);
  const sell = TLC.bestSell(it);
  const x = { it, nd: TLC.needs(it, progress), sell, per: Math.round(sell.net / it.slots) };
  const tmp = document.createElement('div');
  tmp.innerHTML = renderItem(x, data);
  const fresh = tmp.firstElementChild;
  fresh.querySelector('details').open = true;
  li.replaceWith(fresh);
  renderKappaBar(data);
});

// ---- 進捗ページ ----

function renderProgress(data) {
  const doneTasks = data.tasks.filter(x => progress.t.has(x.id)).length;
  const kappaTasks = data.tasks.filter(x => x.k);
  const doneKappa = kappaTasks.filter(x => progress.t.has(x.id)).length;
  const hk = data.hideoutKeys || [];
  const doneHide = hk.filter(k => progress.h.has(k)).length;

  $('p-intro').textContent = t('pIntro', { m: modeName() });
  $('p-stats').innerHTML = [
    [t('pStatTasks'), doneTasks, data.tasks.length],
    [t('pStatKappa'), doneKappa, kappaTasks.length],
    [t('pStatHideout'), doneHide, hk.length],
  ].map(([label, a, b]) => {
    const pct = b ? Math.round(a / b * 100) : 0;
    return `<div class="stat"><div class="bar-label">${esc(label)}<span>${a} / ${b}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');

  document.querySelectorAll('.ptab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ptab === state.ptab)));
  document.querySelectorAll('.ppanel').forEach(p => { p.hidden = p.dataset.ptab !== state.ptab; });
  if (state.ptab === 'tasks') renderTaskList(data);
  if (state.ptab === 'hideout') renderHideout(data);
}

function renderTaskList(data) {
  // アイテムを使うタスクだけに絞ると、チェックする量がぐっと減る
  const usesItems = new Set();
  for (const it of data.items) for (const u of it.u || []) usesItems.add(u[0]);
  const q = normalize(state.pq);
  const groups = new Map();
  data.tasks.forEach((task, i) => {
    if (state.onlyItems && !usesItems.has(i) && !task.k) return;
    const trader = en() ? (task.tre || task.tr) : task.tr;
    if (q && !normalize(`${task.n} ${task.ne || ''} ${task.tr} ${task.tre || ''}`).includes(q)) return;
    if (!groups.has(trader)) groups.set(trader, []);
    groups.get(trader).push(task);
  });
  if (!groups.size) { $('p-tasks').innerHTML = `<p class="meta">${t('pNoTasks')}</p>`; return; }
  $('p-tasks').innerHTML = [...groups].map(([trader, tasks]) => {
    const done = tasks.filter(x => progress.t.has(x.id)).length;
    return `<details class="group" data-group="${esc(trader)}" ${q ? 'open' : ''}><summary>${esc(trader || '—')}<span>${done} / ${tasks.length}</span></summary><ul class="checks">${tasks
      .sort((a, b) => (a.lv || 0) - (b.lv || 0))
      .map(x => `<li><label><input type="checkbox" data-task="${esc(x.id)}" ${progress.t.has(x.id) ? 'checked' : ''}>
        <span>${x.k ? '<span class="k">[Kappa]</span> ' : ''}${esc(en() ? (x.ne || x.n) : x.n)}</span>${x.lv ? `<small>${t('pLevel', { n: x.lv })}</small>` : ''}</label></li>`).join('')}</ul></details>`;
  }).join('');
}

function renderHideout(data) {
  // 施設ごとに「今のレベル」を選ぶ形にする（Lv3を選べばLv1〜3を完了扱い）
  const stations = new Map();
  (data.hideoutKeys || []).forEach((key, i) => {
    const [sid, lv] = key.split(':');
    const name = (en() ? data.hideoutEn[i] : data.hideout[i]).replace(/\s*Lv\d+$/, '');
    if (!stations.has(sid)) stations.set(sid, { name, levels: [] });
    stations.get(sid).levels.push(Number(lv));
  });
  $('p-hideout').innerHTML = `<ul class="stations">${[...stations].map(([sid, st]) => {
    const levels = st.levels.sort((a, b) => a - b);
    const current = levels.filter(lv => progress.h.has(`${sid}:${lv}`)).reduce((m, lv) => Math.max(m, lv), 0);
    return `<li><span>${esc(st.name)}</span><select data-station="${esc(sid)}" aria-label="${esc(st.name)} ${esc(t('pStation'))}">
      <option value="0">—</option>${levels.map(lv => `<option value="${lv}" ${lv === current ? 'selected' : ''}>${t('pLevel', { n: lv })}</option>`).join('')}</select></li>`;
  }).join('')}</ul>`;
}

$progress.addEventListener('change', async e => {
  const data = await TLC.loadMode(state.mode);
  const box = e.target.closest('[data-task]');
  if (box) {
    if (box.checked) {
      // 前提タスクもさかのぼって完了にする（受けられた時点で前提は終わっているはずなので）
      const stack = [data.taskById.get(box.dataset.task)];
      while (stack.length) {
        const task = data.tasks[stack.pop()];
        if (!task) continue;
        progress.t.add(task.id);
        if (state.cascade) stack.push(...(task.pre || []).filter(p => !progress.t.has(data.tasks[p]?.id)));
      }
    } else {
      progress.t.delete(box.dataset.task);
    }
    TLC.saveProgress(state.mode, progress);
    // 開いていたトレーダーの欄は、書き直したあとも開いたままにする
    const open = [...document.querySelectorAll('#p-tasks details[open]')].map(d => d.dataset.group);
    renderProgress(data);
    document.querySelectorAll('#p-tasks details').forEach(d => { if (open.includes(d.dataset.group)) d.open = true; });
    return;
  }
  const sel = e.target.closest('[data-station]');
  if (sel) {
    const lv = Number(sel.value);
    for (const key of data.hideoutKeys || []) {
      const [sid, l] = key.split(':');
      if (sid !== sel.dataset.station) continue;
      if (Number(l) <= lv) progress.h.add(key); else progress.h.delete(key);
    }
    TLC.saveProgress(state.mode, progress);
    renderProgress(data);
  }
});

$('p-filter').addEventListener('input', e => { state.pq = e.target.value.trim(); render(); });
$('p-cascade').addEventListener('change', e => { state.cascade = e.target.checked; });
$('p-only').addEventListener('change', e => { state.onlyItems = e.target.checked; render(); });
document.querySelectorAll('.ptab').forEach(b => b.addEventListener('click', () => { state.ptab = b.dataset.ptab; render(); }));

// 進捗コード：JSONをBase64（英数字の文字列）にしたもの。サーバーを使わずに端末間で移せる
$('p-copy').addEventListener('click', async () => {
  const json = JSON.stringify({ v: 1, m: state.mode, t: [...progress.t], h: [...progress.h], o: progress.o });
  const code = btoa(unescape(encodeURIComponent(json)));
  $('p-code').value = code;
  try { await navigator.clipboard.writeText(code); } catch {}
  $('p-msg').textContent = t('pCopied');
});
$('p-load').addEventListener('click', () => {
  try {
    const obj = JSON.parse(decodeURIComponent(escape(atob($('p-code').value.trim()))));
    progress = { t: new Set(obj.t || []), h: new Set(obj.h || []), o: obj.o || {} };
    TLC.saveProgress(state.mode, progress);
    $('p-msg').textContent = t('pLoaded');
    render();
  } catch {
    $('p-msg').textContent = t('pBad');
  }
});
$('p-reset').addEventListener('click', () => {
  if (!confirm(t('pResetConfirm', { m: modeName() }))) return;
  progress = { t: new Set(), h: new Set(), o: {} };
  TLC.saveProgress(state.mode, progress);
  render();
});

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
  const hash = state.view === 'progress' ? '#progress' : '';
  history.replaceState(null, '', (p.toString() ? `?${p}` : location.pathname) + hash);
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
  state.view = location.hash === '#progress' ? 'progress' : 'search';
  $q.value = state.q;
  $sort.value = state.sort;
  progress = TLC.loadProgress(state.mode);
}

function syncButtons() {
  document.querySelectorAll('.mode').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
  document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-current', b.dataset.view === state.view ? 'page' : 'false'));
  $search.hidden = state.view !== 'search';
  $progress.hidden = state.view !== 'progress';
}

// ---- 小さな道具 ----

function minutesSince(iso) { return iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : Infinity; }
function ago(min) {
  if (!isFinite(min)) return t('unknown');
  if (min < 60) return t('minAgo', { n: min });
  if (min < 60 * 24) return t('hourAgo', { n: Math.round(min / 60) });
  return t('dayAgo', { n: Math.round(min / 1440) });
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
  progress = TLC.loadProgress(state.mode);
  syncButtons();
  $meta.textContent = t('loading');
  render();
}));

// 「検索」「進捗」の切り替え。ページを読み直さずに表示だけ入れ替える
document.querySelectorAll('[data-view]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  state.view = a.dataset.view;
  syncButtons();
  render();
  window.scrollTo(0, 0);
}));
window.addEventListener('hashchange', () => {
  state.view = location.hash === '#progress' ? 'progress' : 'search';
  syncButtons();
  render();
});

// 別のタブで進捗を変えたときも、このタブの表示を合わせる
window.addEventListener('storage', e => {
  if (e.key === `tlc:progress:${state.mode}`) { progress = TLC.loadProgress(state.mode); render(); }
});

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
  $('foot-data').innerHTML = esc(t('footData', { src: '\u0000' })).replace('\u0000', '<a href="https://tarkov.dev" target="_blank" rel="noopener">tarkov.dev</a>');
  // ガイドなどのページは言語ごとに分かれているので、リンク先を切り替える
  document.querySelectorAll('[data-href-en]').forEach(a => { a.href = en() ? a.dataset.hrefEn : a.dataset.hrefJa; });
  updateSeasonTitle();
}

// 「/」でいつでも検索欄へ、「Esc」で入力を消す
document.addEventListener('keydown', e => {
  if (state.view !== 'search') return;
  if (e.key === '/' && document.activeElement !== $q && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
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
    const st = await TLC.fetchJson('status.json');
    seasonAvailable = !!st.modes?.season?.ok;
  } catch {}
  const btn = document.querySelector('.mode[data-mode="season"]');
  btn.disabled = !seasonAvailable;
  updateSeasonTitle();
  if (state.mode === 'season' && !seasonAvailable) {
    state.mode = 'regular';
    progress = TLC.loadProgress(state.mode);
    syncButtons();
    render();
  }
}

function updateSeasonTitle() {
  const btn = document.querySelector('.mode[data-mode="season"]');
  btn.title = btn.disabled ? t('seasonMissing') : '';
}

state.lang = TLC.detectLang();
applyLang();
restoreState();
syncButtons();
TLC.setupMonetization();
render();
detectSeason();
