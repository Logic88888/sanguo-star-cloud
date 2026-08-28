// 从 renwu_process_v1.csv 的父亲/配偶/兄弟列自动生成血缘关系网，
// 与 relations.json 中手工梳理的剧情关系（桃园结义/连环计/宿敌等）合并。
// 幂等：重复运行只会在 CSV 变化时追加，手工线永远优先保留。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const dataDir = new URL('../data/', import.meta.url);
const csvPath = new URL('renwu_process_v1.csv', dataDir);
if (!existsSync(csvPath)) {
  console.error('未找到 data/renwu_process_v1.csv（导入人物时 应已随下载获得）');
  process.exit(1);
}

function parseCSV(text) {
  const rows = []; let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length) { row.push(field); rows.push(row); field = ''; row = []; }
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const chars = JSON.parse(readFileSync(new URL('characters.json', dataDir), 'utf8'));
const names = new Set(chars.map((c) => c.name));
const gender = new Map(chars.map((c) => [c.name, c.gender || c.sex || '']));
// characters.json 没有 gender 字段，回查 CSV 的性别列
const rows = parseCSV(readFileSync(csvPath, 'utf8'));
const header = rows[0];
const iN = header.indexOf('名字'), iF = header.indexOf('父亲'), iS = header.indexOf('配偶'),
      iB = header.indexOf('兄弟'), iG = header.indexOf('性别');
const rowByName = new Map();
for (const r of rows.slice(1)) rowByName.set((r[iN] || '').trim(), r);

const clean = (v) => {
  v = (v || '').trim();
  return !v || v === '未知' || v === '暂无相关记载' ? '' : v;
};
// 「刘弘[刘备父]」→「刘弘」；多个用 | 分隔
const splitPeople = (v) =>
  clean(v).split('|').map((s) => s.trim().replace(/\[[^\]]*\]/g, '').trim()).filter(Boolean);

const cur = JSON.parse(readFileSync(new URL('relations.json', dataDir), 'utf8'));
// 家族类连线标记为自动生成（手工剧情线不含这四类），供前端区分「剧情度」与「家族度」
for (const e of cur) if (['父子', '父女', '兄弟', '夫妻'].includes(e.type)) e.auto = 1;
const out = [...cur];
const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const seen = new Set(cur.map((e) => pairKey(e.a, e.b)));

let added = 0, noMatch = 0;
const add = (a, b, type) => {
  if (!a || !b || a === b) return;
  if (!names.has(a) || !names.has(b)) { noMatch++; return; }
  const k = pairKey(a, b);
  if (seen.has(k)) return;
  seen.add(k);
  out.push({ a, b, type, auto: 1 });
  added++;
};

for (const r of rows.slice(1)) {
  const name = (r[iN] || '').trim();
  if (!names.has(name)) continue;
  const isFemale = (r[iG] || '').trim() === '女';

  const father = splitPeople(r[iF])[0];
  if (father) add(father, name, isFemale ? '父女' : '父子');

  for (const sp of splitPeople(r[iS])) add(name, sp, '夫妻');
  for (const br of splitPeople(r[iB])) add(name, br, '兄弟');
}

writeFileSync(new URL('relations.json', dataDir), JSON.stringify(out, null, 2));
console.log(`关系总数: ${out.length}（手工 ${cur.length} + 自动新增 ${added}；未匹配人物对 ${noMatch} 跳过）`);
