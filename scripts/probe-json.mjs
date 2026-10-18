// 調査用：json.tarkov.dev の配布ファイルの一覧と中身の形を out/probe.json に書き出す
import fs from 'node:fs';

const BASE = 'https://json.tarkov.dev/';
const out = { at: new Date().toISOString() };

function shape(v, depth = 0) {
  if (Array.isArray(v)) return v.length ? [`len=${v.length}`, shape(v[0], depth + 1)] : [];
  if (v && typeof v === 'object') {
    if (depth > 3) return '{…}';
    const o = {};
    for (const [k, x] of Object.entries(v).slice(0, 40)) o[k] = shape(x, depth + 1);
    return o;
  }
  return typeof v === 'string' ? `str:${v.slice(0, 60)}` : v;
}

async function get(path) {
  const res = await fetch(BASE + path);
  const text = await res.text();
  try { return { status: res.status, size: text.length, json: JSON.parse(text) }; }
  catch { return { status: res.status, size: text.length, text: text.slice(0, 500) }; }
}

const cat = await get('endpoints');
out.endpoints = cat.json ?? cat;
const names = new Set();
const walk = v => {
  if (typeof v === 'string' && /^[a-z_]+$/i.test(v)) names.add(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
walk(out.endpoints);
out.samples = {};
for (const n of ['items', 'tasks', 'hideout', 'hideoutStations', 'item_prices', 'prices', 'traders', ...names].slice(0, 30)) {
  for (const p of [`regular/${n}`, `regular/${n}_ja`, `pve/${n}`]) {
    if (out.samples[p]) continue;
    const r = await get(p);
    out.samples[p] = r.json ? { status: r.status, size: r.size, shape: shape(r.json) } : r;
  }
}
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/probe.json', JSON.stringify(out, null, 1));
console.log('probe done');
