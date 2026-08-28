// 一次性合并脚本：把 4 个阵营骨架文件并入 characters.json（10 人完整数据保留）
// 用法：node scripts/merge-skeleton.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const full = JSON.parse(readFileSync(join(dataDir, 'characters.json'), 'utf8'));
// 黑名单：非三国时期人物（见 remove-non-era.mjs）
const exclude = new Set(
  existsSync(join(dataDir, 'exclude-names.json'))
    ? JSON.parse(readFileSync(join(dataDir, 'exclude-names.json'), 'utf8'))
    : []
);
const parts = [
  ['wei', 'part-wei.json'],
  ['shu', 'part-shu.json'],
  ['wu', 'part-wu.json'],
  ['other', 'part-other.json'],
  ['wei', 'part2-wei.json'],
  ['shu', 'part2-shu.json'],
  ['wu', 'part2-wu.json'],
  ['other', 'part2-other.json'],
  ['wei', 'part3-wei.json'],
  ['shu', 'part3-shu.json'],
  ['wu', 'part3-wu.json'],
  ['other', 'part3-other.json'],
  ['wei', 'part4-wei.json'],
  ['shu', 'part4-shu.json'],
  ['wu', 'part4-wu.json'],
  ['other', 'part4-other.json'],
];
const seen = new Set(full.map((c) => c.name));
let nextId = full.length + 1;
const out = [...full];
const report = [];

for (const [faction, file] of parts) {
  const p = join(dataDir, file);
  if (!existsSync(p)) {
    report.push(`缺失文件: ${file}`);
    continue;
  }
  let arr;
  try {
    arr = JSON.parse(readFileSync(p, 'utf8'));
  } catch (err) {
    report.push(`JSON 解析失败: ${file} -> ${err.message}`);
    continue;
  }
  let added = 0;
  for (const e of arr) {
    if (!e || !e.name) {
      report.push(`无效条目(无姓名): ${file}`);
      continue;
    }
    if (seen.has(e.name) || exclude.has(e.name)) {
      report.push(`重复/黑名单跳过: ${e.name} (${file})`);
      continue;
    }
    seen.add(e.name);
    out.push({
      id: nextId++,
      name: e.name,
      courtesy: e.courtesy || '',
      title: e.title || '',
      faction,
      role: e.role || '',
      years: e.years || '',
      bio: '',
      quote: '',
      quoteSource: '',
    });
    added++;
  }
  report.push(`${faction}: 文件 ${arr.length} 条, 新增 ${added} 条`);
}

writeFileSync(join(dataDir, 'characters.json'), JSON.stringify(out, null, 2));
console.log(`总人数: ${out.length} | 已有简介: ${out.filter((c) => c.bio).length}`);
for (const r of report) console.log(r);
