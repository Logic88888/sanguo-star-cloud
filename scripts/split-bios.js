// 把 characters.json 里的大文本字段（bio / quote / quoteSource）抽取到
// public/data/bios.json（按名字索引，随页面按需 fetch），并从主数据中删除这些字段。
// 这样首屏打包进 JS 的只有名字/势力/年代等轻量字段，显著减小首包体积。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const chars = JSON.parse(fs.readFileSync(path.join(root, 'data/characters.json'), 'utf8'));

const bios = {};
for (const c of chars) {
  const pick = {};
  if (c.bio) pick.bio = c.bio;
  if (c.quote) pick.quote = c.quote;
  if (c.quoteSource) pick.quoteSource = c.quoteSource;
  if (Object.keys(pick).length) bios[c.name] = pick;
}
for (const c of chars) {
  delete c.bio;
  delete c.quote;
  delete c.quoteSource;
}

fs.mkdirSync(path.join(root, 'public/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/data/bios.json'), JSON.stringify(bios));
fs.writeFileSync(path.join(root, 'data/characters.json'), JSON.stringify(chars));

const before = JSON.stringify(bios).length;
console.log('拆出 bios 条目:', Object.keys(bios).length, '| bios.json 体积:', (before / 1024).toFixed(1), 'KB');
console.log('characters 精简后:', chars.length, '人');
