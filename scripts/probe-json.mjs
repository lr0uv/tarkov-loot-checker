// 調査用：json.tarkov.dev のファイルの中身の形を out/probe.json に書き出す
import fs from 'node:fs';

const BASE = 'https://json.tarkov.dev/';
const out = { at: new Date().toISOString() };
const get = async p => (await fetch(BASE + p)).json();

const items = (await get('regular/items')).data;
out.itemsTopKeys = Object.keys(items);
const gpu = items.items['57347ca924597744596b4e71'];
out.gpu = gpu && Object.fromEntries(Object.entries(gpu).filter(([k]) => !/image|Link$/i.test(k) || k === 'iconLink'));
const allKeys = new Set();
for (const it of Object.values(items.items)) Object.keys(it).forEach(k => allKeys.add(k));
out.itemAllKeys = [...allKeys];
for (const k of out.itemsTopKeys) if (k !== 'items') out['items.' + k] = JSON.stringify(items[k]).slice(0, 800);

const tasks = (await get('regular/tasks')).data;
out.tasksTopKeys = Object.keys(tasks);
const tlist = Object.values(tasks.tasks);
out.taskCount = tlist.length;
const objTypes = {};
for (const t of tlist) for (const o of t.objectives || []) if (!objTypes[o.type]) objTypes[o.type] = o;
out.objectiveSamples = objTypes;
out.taskKeys = [...new Set(tlist.flatMap(t => Object.keys(t)))];
for (const k of out.tasksTopKeys) if (k !== 'tasks') out['tasks.' + k] = JSON.stringify(tasks[k]).slice(0, 600);

const hideout = (await get('regular/hideout')).data;
out.hideoutLevelSample = Object.values(hideout)[7]?.levels?.[1];

const traders = (await get('regular/traders')).data;
out.tradersShape = JSON.stringify(traders).slice(0, 800);
const tja = (await get('regular/traders_ja')).data;
out.tradersJa = JSON.stringify(tja).slice(0, 600);

const season = await fetch(BASE + 'pvp-season/items').then(r => r.status + ' ' + r.headers.get('content-length')).catch(e => e.message);
out.seasonItems = season;
const seasonInfo = await fetch(BASE + 'pvp-season/season').then(r => r.text()).catch(e => e.message);
out.seasonInfo = seasonInfo.slice(0, 1500);

fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/probe.json', JSON.stringify(out, null, 1));
console.log('probe done');
