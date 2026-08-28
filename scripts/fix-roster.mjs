// 一次性名单修正：移除存疑/误入名字，改名，跨阵营迁移，补漏的重要人物
import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../data/characters.json', import.meta.url);
const chars = JSON.parse(readFileSync(p, 'utf8'));

const remove = new Set([
  '于诠', '夏侯威', '夏侯惠', '管宁',        // 魏里拿不准的
  '张星彩', '黄叙', '虞钦', '徐商', '王坚', '刘德', // 蜀里拿不准/游戏角色
  '牛氏',                                     // 吴里拿不准的
]);

let out = chars.filter((c) => !remove.has(c.name));
for (const c of out) {
  if (c.name === '曹娥') { c.faction = 'other'; c.role = '女性'; } // 曹娥碑故事属汉末典故
  if (c.name === '荀谌') { c.faction = 'other'; c.role = '谋士'; } // 他在袁绍营
  if (c.name === '阳松') c.name = '杨松';
  if (c.name === '张谦') c.name = '张卫';
  if (c.name === '周黄') c.name = '杨任';
}

const add = (name, courtesy, faction, role) =>
  out.push({ id: 0, name, courtesy, title: '', faction, role, years: '', bio: '', quote: '', quoteSource: '' });

// 魏补充
add('蔡瑁', '德珪', 'wei', '武将');
add('蒋干', '子翼', 'wei', '谋士');
add('曹真', '子丹', 'wei', '宗室');
add('郭淮', '伯济', 'wei', '名将');
add('文鸯', '', 'wei', '名将');
add('诸葛诞', '公休', 'wei', '武将');
add('郝昭', '伯道', 'wei', '名将');
add('王双', '', 'wei', '武将');
add('羊祜', '叔子', 'wei', '名将');
add('杜预', '元凯', 'wei', '名将');
// 蜀补充
add('周仓', '', 'shu', '武将');
add('刘辟', '', 'shu', '武将');
add('龚都', '', 'shu', '武将');
add('徐庶', '元直', 'shu', '谋士');
// 吴补充
add('孙坚', '文台', 'wu', '君主');
add('陆抗', '幼节', 'wu', '名将');
add('徐氏', '', 'wu', '女性');
// 群雄补充
add('王允', '子师', 'other', '谋士');
add('司马徽', '德操', 'other', '方士');
add('许攸', '子远', 'other', '谋士');
add('淳于琼', '', 'other', '武将');
add('麴义', '', 'other', '武将');
add('陶谦', '恭祖', 'other', '君主');
add('马腾', '寿成', 'other', '君主');
add('韩遂', '文约', 'other', '君主');
add('何进', '', 'other', '武将');
add('董承', '', 'other', '文官');
add('吉平', '', 'other', '文官');
add('祢衡', '正平', 'other', '文官');
add('陈琳', '孔璋', 'other', '文官');
add('张梁', '', 'other', '方士');

out.forEach((c, i) => (c.id = i + 1));
writeFileSync(p, JSON.stringify(out, null, 2));

const names = out.map((c) => c.name);
const dup = names.filter((n, i) => names.indexOf(n) !== i);
const byF = {};
out.forEach((c) => (byF[c.faction] = (byF[c.faction] || 0) + 1));
console.log('总人数:', out.length, '| 姓名重复:', dup.length ? dup.join(',') : '无', '| 分阵营:', JSON.stringify(byF));
