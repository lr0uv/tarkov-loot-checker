// アイテムごとのページで、最新の価格を読み込んで表示する。
// ページ自体には価格を書いておらず（毎回ページを作り直さずに済むように）、開いたときにここで埋める。

(() => {
  const box = document.getElementById('live');
  if (!box) return;
  const id = box.dataset.id;
  const ja = box.dataset.lang !== 'en';
  const L = ja
    ? { flea: 'フリマ最安', fee: '手数料（目安）', net: 'フリマ手取り', trader: 'トレーダー最高', per: '1マスあたり', avg: '24時間平均',
      change: '48時間の値動き', left: 'あと必要（進捗反映）', none: '—', noFlea: '出品不可', updated: '価格の調査: {t}', error: '価格を読み込めませんでした。' }
    : { flea: 'Flea lowest', fee: 'Fee (est.)', net: 'Flea take-home', trader: 'Best trader', per: 'Per slot', avg: '24h average',
      change: '48h change', left: 'Still needed (your progress)', none: '—', noFlea: 'Banned', updated: 'Prices scanned {t}', error: 'Could not load prices.' };
  const MODES = { regular: 'PvP', pve: 'PvE' };
  let mode = 'regular';
  try { if (localStorage.getItem('mode') === 'pve') mode = 'pve'; } catch {}

  // PvP・PvE の切り替えボタンを価格の上に置く
  const tabs = document.createElement('div');
  tabs.className = 'modes';
  tabs.style.marginBottom = '8px';
  tabs.style.width = 'fit-content';
  tabs.innerHTML = Object.entries(MODES).map(([m, label]) => `<button class="mode" data-mode="${m}" role="tab">${label}</button>`).join('');
  box.before(tabs);
  const note = document.createElement('p');
  note.className = 'hint';
  box.after(note);

  tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode;
    try { localStorage.setItem('mode', mode); } catch {}
    show();
  });

  async function show() {
    tabs.querySelectorAll('.mode').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    try {
      const data = await TLC.loadMode(mode);
      const it = data.items.find(x => x.id === id);
      if (!it) throw new Error('not found');
      const sell = TLC.bestSell(it);
      const fee = !it.nf && it.f && it.bp ? TLC.fleaFee(it.bp, it.f) : 0;
      const nd = TLC.needs(it, TLC.loadProgress(mode));
      const cells = [
        [L.flea, it.nf ? L.noFlea : TLC.rub(it.f)],
        [L.fee, fee ? TLC.rub(fee) : L.none],
        [L.net, fee ? TLC.rub(Math.max(0, it.f - fee)) : L.none],
        [L.trader, it.t ? `${TLC.rub(it.t[1])} <small>${TLC.esc(ja ? it.t[0] : (it.t[2] || it.t[0]))}</small>` : L.none],
        [L.per, TLC.rub(Math.round(sell.net / (it.w || 1)))],
        [L.avg, it.nf ? L.none : TLC.rub(it.a)],
      ];
      if (it.c) cells.push([L.change, `<span class="${it.c > 0 ? 'up' : 'down'}">${it.c > 0 ? '+' : ''}${it.c}%</span>`]);
      if (nd.total || nd.owned) cells.push([L.left, String(nd.left)]);
      box.innerHTML = cells.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
      note.textContent = L.updated.replace('{t}', new Date(data.updatedAt).toLocaleString(ja ? 'ja-JP' : 'en-US'));
    } catch {
      box.innerHTML = `<div><span>${L.error}</span><b>—</b></div>`;
    }
  }
  show();
})();
