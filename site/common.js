// 検索ページとアイテムページで共通に使う道具。
// データの読み込み、文字の正規化、フリマ手数料、進捗の保存、必要数の計算、広告・寄付の設定をまとめている。

const TLC = (() => {
  const DATA_BASE = 'https://raw.githubusercontent.com/lr0uv/tarkov-loot-checker/data/';
  const MODES = ['regular', 'pve', 'season'];

  // ---- データの読み込み ----

  async function fetchJson(name) {
    // ?t= を付けるのは、ブラウザが古いファイルを使い回さないようにするため（5分単位で変える）
    const res = await fetch(`${DATA_BASE}${name}?t=${Math.floor(Date.now() / 300000)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  const cache = {};
  function loadMode(mode) {
    if (!cache[mode]) {
      cache[mode] = fetchJson(`${mode}.json`).then(prepare).catch(e => {
        delete cache[mode]; // 失敗したら次回やり直せるように消しておく
        throw e;
      });
    }
    return cache[mode];
  }

  // プレイヤーがよく使う呼び方。右側の英語名を含むアイテムが、左側の言葉でも検索に出るようにする
  const NICKNAMES = {
    'グラボ': 'graphics card', 'レドックス': 'ledx', 'ビットコ': 'physical bitcoin', 'ビットコイン': 'physical bitcoin',
    'ガスアナ': 'gas analyzer', 'ライオン': 'bronze lion', 'ネコ': 'cat figurine', '猫': 'cat figurine',
    'ロレックス': 'roler', 'テトリス': 'tetriz', 'サレワ': 'salewa', 'グリズリー': 'grizzly',
    'ドッグタグ': 'dogtag', 'タンクバッテリー': 'tank battery', 'インテル': 'intelligence folder',
    '情報フォルダ': 'intelligence folder', 'cpu': 'pc cpu', 'プロセッサ': 'pc cpu',
    '赤カード': 'keycard (red)', 'レッドカード': 'keycard (red)', '青カード': 'keycard (blue)',
    '緑カード': 'keycard (green)', '紫カード': 'keycard (violet)', '黒カード': 'keycard (black)', '黄カード': 'keycard (yellow)',
  };

  // 表示や並び替えに使う値を、読み込んだときに一度だけ計算しておく（進捗に関係しない部分だけ）
  function prepare(data) {
    const nick = Object.entries(NICKNAMES);
    data.taskById = new Map(data.tasks.map((t, i) => [t.id, i]));
    for (const it of data.items) {
      const en = (it.e || '').toLowerCase();
      const alias = nick.filter(([, target]) => en.includes(target)).map(([n]) => n).join(' ');
      it.key = normalize(`${it.n} ${it.e} ${it.s} ${it.se || ''} ${alias}`);
      it.slots = it.w || 1;
      it.uses = (it.u || []).map(([ti, count, fir]) => ({ ti, ...data.tasks[ti], count, fir }));
      it.hide = (it.h || []).map(([hi, count, fir]) => ({
        hi, key: data.hideoutKeys?.[hi], name: data.hideout[hi], ne: data.hideoutEn?.[hi] || data.hideout[hi], count, fir,
      }));
    }
    return data;
  }

  // 検索用に文字をそろえる（全角半角・大文字小文字・カタカナとひらがなの違いをなくす）
  function normalize(s) {
    return String(s).normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[\s\-・.()（）]/g, '');
  }

  // アイテム名などをそのままHTMLに入れると、悪意ある文字列で画面を壊されることがあるので無害化する
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function rub(n) { return n ? `${Math.round(n).toLocaleString('en-US')}₽` : '—'; }

  // ---- フリマ手数料（目安） ----
  // tarkov.dev などで使われている計算式。bp はアイテムの基本価格、price は出品価格。
  // ハイドアウトの情報センターなどによる割引は入れていない
  function fleaFee(bp, price) {
    if (!bp || !price) return 0;
    const Ti = 0.03, Tr = 0.03;
    let po = Math.log10(bp / price);
    let pr = Math.log10(price / bp);
    if (price < bp) po = Math.pow(po, 1.08);
    else pr = Math.pow(pr, 1.08);
    return Math.ceil(bp * Ti * Math.pow(4, po) + price * Tr * Math.pow(4, pr));
  }

  // 一番お金になる売り先。フリマは手数料を引いた手取りでトレーダーと比べる
  function bestSell(it) {
    const flea = it.nf ? 0 : it.f || 0;
    const fee = flea ? fleaFee(it.bp, flea) : 0;
    const net = Math.max(0, flea - fee);
    const trader = it.t ? it.t[1] : 0;
    if (net > trader) return { flea: true, price: flea, fee, net, level: it.ml };
    return { flea: false, where: it.t ? [it.t[0], it.t[2] || it.t[0]] : ['—', '—'], price: trader, net: trader };
  }

  // ---- 進捗（ブラウザの中だけに保存。モードごとに別々） ----
  // t: 完了したタスクID、h: 完了したハイドアウト（施設ID:レベル）、o: 持っている数 { アイテムID: 個数 }

  function loadProgress(mode) {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(`tlc:progress:${mode}`) || 'null'); } catch {}
    return { t: new Set(raw?.t || []), h: new Set(raw?.h || []), o: raw?.o || {} };
  }

  function saveProgress(mode, p) {
    try {
      localStorage.setItem(`tlc:progress:${mode}`, JSON.stringify({ t: [...p.t], h: [...p.h], o: p.o }));
    } catch {}
  }

  // 進捗を考えたうえで、そのアイテムがあと何個必要かを計算する
  function needs(it, progress) {
    const uses = it.uses.map(u => ({ ...u, done: progress.t.has(u.id) }));
    const hide = it.hide.map(h => ({ ...h, done: h.key ? progress.h.has(h.key) : false }));
    const open = list => list.filter(x => !x.done);
    const sum = list => list.reduce((n, x) => n + x.count, 0);
    const kappaN = sum(open(uses).filter(u => u.k));
    const taskN = sum(open(uses)) - kappaN;
    const hideN = sum(open(hide));
    const total = kappaN + taskN + hideN;
    const owned = Math.max(0, Number(progress.o[it.id]) || 0);
    const left = Math.max(0, total - owned);
    const openAll = [...open(uses), ...open(hide)];
    const fir = !openAll.length ? '' : openAll.every(x => x.fir) ? 'all' : openAll.some(x => x.fir) ? 'some' : '';
    const hadNeeds = uses.length + hide.length > 0;
    const verdict = left
      ? (kappaN ? 'kappa' : taskN ? 'task' : 'hideout')
      : total ? 'enough' : hadNeeds ? 'done' : 'sell';
    return { uses, hide, kappaN, taskN, hideN, total, owned, left, fir, verdict };
  }

  // ---- 言語 ----
  // URLの ?lang= → 前回選んだ言語 → ブラウザの言語設定 の順で決める。日本語以外のブラウザは英語にする
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

  // ---- 広告・アクセス解析・寄付（config.js にIDが入っているときだけ動く） ----
  function setupMonetization() {
    const c = window.TLC_CONFIG || {};
    if (c.adsenseClient) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(c.adsenseClient)}`;
      s.crossOrigin = 'anonymous';
      document.head.appendChild(s);
    }
    if (c.ga4Id) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(c.ga4Id)}`;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', c.ga4Id);
    }
    // 寄付のURLが決まるまでは「応援する」ボタンを隠しておく
    document.querySelectorAll('[data-support]').forEach(el => {
      if (c.supportUrl) { el.href = c.supportUrl; el.hidden = false; } else el.hidden = true;
    });
    document.querySelectorAll('[data-contact]').forEach(el => {
      if (c.contactUrl) el.href = c.contactUrl;
    });
  }

  return { MODES, fetchJson, loadMode, normalize, esc, rub, fleaFee, bestSell, loadProgress, saveProgress, needs, detectLang, setupMonetization };
})();
