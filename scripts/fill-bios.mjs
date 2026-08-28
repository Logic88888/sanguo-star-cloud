// 把 bios-*.json 中的简介按姓名填回 characters.json
import { readFileSync, writeFileSync } from 'node:fs';

const dataDir = new URL('../data/', import.meta.url);
const chars = JSON.parse(readFileSync(new URL('characters.json', dataDir), 'utf8'));
const byName = new Map(chars.map((c) => [c.name, c]));

let filled = 0;
const missing = [];
for (const f of ['bios-wei', 'bios-shu', 'bios-wu', 'bios-other', 'bios3', 'bios4']) {
  let arr;
  try {
    arr = JSON.parse(readFileSync(new URL(f + '.json', dataDir), 'utf8'));
  } catch (err) {
    console.log('跳过', f, err.message);
    continue;
  }
  for (const e of arr) {
    const c = byName.get(e.name);
    if (!c) {
      missing.push(f + ':' + e.name);
      continue;
    }
    if (e.bio) c.bio = e.bio;
    if (e.quote) c.quote = e.quote;
    if (e.quoteSource) c.quoteSource = e.quoteSource;
    filled++;
  }
}
writeFileSync(new URL('characters.json', dataDir), JSON.stringify(chars, null, 2));
console.log(`填充 ${filled} 条 | 未匹配: ${missing.length ? missing.join('、') : '无'}`);
console.log(`简介完成度: ${chars.filter((c) => c.bio).length} / ${chars.length}`);
