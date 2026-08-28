// 导入「诗云式」全量人物数据（冲上 1000 人的通道）
//
// 用法：
//   1. 浏览器打开并下载（另存为）：
//      https://raw.githubusercontent.com/wcswcswcs/sgyy/master/data/renwu_process_v1.csv
//      保存为 data/renwu_process_v1.csv（与 characters.json 同目录）
//   2. 运行：node scripts/import-renwu.mjs
//
// 脚本会自动：识别表头中的 姓名/主效/字号/官职/小说简介 等列（模糊匹配），
// 把主效映射为魏/蜀/吴/群雄四色，跳过已收录人物，把其余人物全部入库。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const dataDir = new URL('../data/', import.meta.url);
const csvPath = new URL('renwu_process_v1.csv', dataDir);
if (!existsSync(csvPath)) {
  console.error('未找到 data/renwu_process_v1.csv');
  console.error('请先从 https://raw.githubusercontent.com/wcswcswcs/sgyy/master/data/renwu_process_v1.csv 下载，保存到 data/ 目录。');
  process.exit(1);
}

// 简易 CSV 解析（支持引号包裹的字段）
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
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

const text = readFileSync(csvPath, 'utf8');
const rows = parseCSV(text);
if (!rows.length) { console.error('CSV 为空'); process.exit(1); }

const header = rows[0].map((h) => h.trim());
const col = (...aliases) => header.findIndex((h) => aliases.some((a) => h.includes(a)));
const iName = col('名字', '姓名', 'name');
const iFu = col('主效');
const iZeng = col('曾效力');
const iZi = col('字号', '表字');
const iGuan = col('官职');
const iXs = col('小说简介', '小说');
const iLs = col('历史');
const iAge = col('年龄');
if (iName < 0) {
  console.error('未识别到姓名列，表头为：' + header.join(', '));
  process.exit(1);
}
console.log('表头映射 →', { 名字: header[iName], 主效: iFu >= 0 ? header[iFu] : null, 字号: iZi >= 0 ? header[iZi] : null, 小说: iXs >= 0 ? header[iXs] : null, 历史: iLs >= 0 ? header[iLs] : null });

// 清洗占位符
const clean = (v) => {
  v = (v || '').trim();
  return !v || v === '未知' || v === '暂无相关记载' ? '' : v;
};

function factionOf(fu) {
  const s = String(fu || '');
  if (/魏|晋/.test(s)) return 'wei';
  if (/蜀/.test(s)) return 'shu';
  if (/吴/.test(s)) return 'wu';
  return 'other'; // 东汉、群雄、在野、起义军、少数民族等
}

const chars = JSON.parse(readFileSync(new URL('characters.json', dataDir), 'utf8'));
const seen = new Set(chars.map((c) => c.name));
let nextId = chars.length + 1;
let added = 0;
for (const r of rows.slice(1)) {
  const name = (r[iName] || '').trim().replace(/\s+/g, '');
  if (!name || seen.has(name)) continue;
  seen.add(name);
  let zi = iZi >= 0 ? clean(r[iZi]) : '';
  if (zi === name) zi = ''; // 源数据无表字时会重复姓名
  const age = iAge >= 0 ? clean(r[iAge]) : '';
  const years = /\d{3}/.test(age) ? age.replace(/\s/g, '') : '';
  const bio = (iXs >= 0 ? clean(r[iXs]) : '') || (iLs >= 0 ? clean(r[iLs]) : '');
  chars.push({
    id: nextId++,
    name,
    courtesy: zi,
    title: iGuan >= 0 ? clean(r[iGuan]) : '',
    faction: factionOf(iFu >= 0 ? r[iFu] : ''),
    role: '',
    years,
    bio,
    quote: '',
    quoteSource: '',
  });
  added++;
}
writeFileSync(new URL('characters.json', dataDir), JSON.stringify(chars, null, 2));

const byF = {};
chars.forEach((c) => (byF[c.faction] = (byF[c.faction] || 0) + 1));
console.log(`新增 ${added} 人 → 总人数 ${chars.length}`);
console.log('分阵营:', JSON.stringify(byF));
console.log('提示：新入库人物多数没有名言，简介若源数据缺失会显示「撰写中」，可分批补写。');
